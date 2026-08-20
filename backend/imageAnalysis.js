/**
 * imageAnalysis.js
 *
 * Image QA checks for pharmaceutical visual inspection, using Jimp
 * (pure JS, no native deps).
 *
 * PRIMARY QA SIGNALS (product-relevant):
 *  - colorDeviationPercent: average image color vs a reference color -
 *    flags discoloration/color drift
 *  - contaminationPercent: % of pixels that are significant outliers
 *    from the image's own average color - flags foreign particles,
 *    spots, contamination (a uniform sample has very few outlier
 *    pixels; contamination shows up as a spike)
 *
 * SECONDARY / CAPTURE QUALITY GATE (infrastructure, not product QA):
 *  - brightness / isTooDark / isOverexposed
 *  - sharpness / isBlurry
 *  These don't say anything about the product - they say whether the
 *  photo itself is trustworthy enough to analyze at all. If capture
 *  quality fails, the primary QA numbers above should be treated with
 *  caution (see captureQualityOk).
 */

const { Jimp } = require('jimp');

/**
 * Sobel edge detection - computes edge magnitude at each pixel using
 * the standard Sobel operator (horizontal + vertical gradient
 * kernels). Returns edge density (% of pixels that are strong edges)
 * and a rough count of distinct high-edge regions - useful for
 * detecting cracks, chips, or irregular boundaries on
 * tablets/capsules, since a clean intact sample has a smooth,
 * predictable edge profile while a damaged one has extra jagged
 * edge activity.
 */
async function detectEdges(image, edgeThreshold = 100) {
  const grayscale = image.clone().greyscale();
  const { width, height, data } = grayscale.bitmap;

  // Read the grayscale luminance value at (x, y) directly from the
  // raw bitmap buffer - after greyscale(), R/G/B channels are equal,
  // so we just read the R channel.
  function pixelAt(x, y) {
    const idx = (y * width + x) * 4;
    return data[idx];
  }

  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

  let edgePixelCount = 0;
  let totalPixels = 0;
  let totalEdgeMagnitude = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = pixelAt(x + kx, y + ky);
          gx += pixel * sobelX[ky + 1][kx + 1];
          gy += pixel * sobelY[ky + 1][kx + 1];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      totalEdgeMagnitude += magnitude;
      totalPixels++;

      if (magnitude > edgeThreshold) edgePixelCount++;
    }
  }

  const edgeDensityPercent = +((edgePixelCount / totalPixels) * 100).toFixed(2);
  const averageEdgeMagnitude = +(totalEdgeMagnitude / totalPixels).toFixed(2);

  return { edgeDensityPercent, averageEdgeMagnitude };
}const OUTLIER_DISTANCE_THRESHOLD = 60; // tune against real sample images
const CONTAMINATION_PERCENT_THRESHOLD = 2; // % outlier pixels considered contamination

async function analyzeImage(imageBuffer, referenceColor = null) {
  const image = await Jimp.read(imageBuffer);
  const { width, height } = image.bitmap;
  const pixelCount = width * height;

  // --- Pass 1: brightness, average color, sharpness (grayscale) ---
  let totalLuminance = 0;
  let sumR = 0, sumG = 0, sumB = 0;
  const grayscale = new Float64Array(pixelCount);

  image.scan(0, 0, width, height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLuminance += luminance;
    sumR += r; sumG += g; sumB += b;
    grayscale[y * width + x] = luminance;
  });

  const brightness = +(totalLuminance / pixelCount).toFixed(2);
  const avgColor = {
    r: +(sumR / pixelCount).toFixed(1),
    g: +(sumG / pixelCount).toFixed(1),
    b: +(sumB / pixelCount).toFixed(1),
  };

  // Laplacian variance for blur detection
  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let lapCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = grayscale[y * width + x];
      const up = grayscale[(y - 1) * width + x];
      const down = grayscale[(y + 1) * width + x];
      const left = grayscale[y * width + (x - 1)];
      const right = grayscale[y * width + (x + 1)];

      const laplacian = up + down + left + right - 4 * center;
      laplacianSum += laplacian;
      laplacianSumSq += laplacian * laplacian;
      lapCount++;
    }
  }

  const lapMean = laplacianSum / lapCount;
  const lapVariance = laplacianSumSq / lapCount - lapMean * lapMean;
  const sharpness = +lapVariance.toFixed(2);

  // --- Color deviation vs external reference (if provided) ---
  let colorDeviationPercent = null;
  if (referenceColor) {
    const dr = avgColor.r - referenceColor.r;
    const dg = avgColor.g - referenceColor.g;
    const db = avgColor.b - referenceColor.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const maxDistance = Math.sqrt(255 * 255 * 3);
    colorDeviationPercent = +((distance / maxDistance) * 100).toFixed(2);
  }

  // --- Pass 2: contamination / defect detection ---
  // Uses the image's own average color as the "expected uniform" color,
  // then counts what % of pixels are significant outliers from it.
  // A clean, uniform sample has a low outlier %; contamination, foreign
  // particles, or spots show up as a spike in outlier %.
  let outlierCount = 0;

  image.scan(0, 0, width, height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];

    const dr = r - avgColor.r;
    const dg = g - avgColor.g;
    const db = b - avgColor.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    if (distance > OUTLIER_DISTANCE_THRESHOLD) {
      outlierCount++;
    }
  });
    const edgeResult = await detectEdges(image);
  const contaminationPercent = +((outlierCount / pixelCount) * 100).toFixed(2);
  const isContaminated = contaminationPercent > CONTAMINATION_PERCENT_THRESHOLD;

  // --- Capture quality gate (secondary - infrastructure, not product QA) ---
  const isTooDark = brightness < 50;
  const isOverexposed = brightness > 220;
  const isBlurry = sharpness < 100; // tune against real sample images
  const captureQualityOk = !isTooDark && !isOverexposed && !isBlurry;

    return {
    width,
    height,
    // Primary QA signals
    colorDeviationPercent,
    contaminationPercent,
    isContaminated,
    edgeDensityPercent: edgeResult.edgeDensityPercent,
    averageEdgeMagnitude: edgeResult.averageEdgeMagnitude,
    isIrregularEdges: edgeResult.edgeDensityPercent > 25,
    // Secondary capture-quality gate
    captureQualityOk,
    brightness,
    isTooDark,
    isOverexposed,
    sharpness,
    isBlurry,
    avgColor,
  };
}

module.exports = {
  analyzeImage,
  detectEdges,
};