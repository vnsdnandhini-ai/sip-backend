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
}
/**
 * Local Binary Pattern (LBP) texture analysis.
 *
 * For each pixel, compares it to its 8 neighbors and builds an 8-bit
 * pattern (1 if neighbor >= center, 0 if darker). Accumulates a
 * histogram of these patterns across the image, then computes the
 * Shannon entropy of that histogram as a single "texture chaos" score.
 *
 * A smooth/uniform surface produces a small number of dominant LBP
 * patterns (low entropy). A rough/irregular surface (damage, mold,
 * contamination) produces a wider, more chaotic spread of patterns
 * (high entropy) - a genuinely different signal than simple pixel
 * color variance, since two surfaces can have similar color spread
 * but very different local texture structure.
 */
function computeLBPTexture(image) {
  const grayscale = image.clone().greyscale();
  const { width, height, data } = grayscale.bitmap;

  function pixelAt(x, y) {
    const idx = (y * width + x) * 4;
    return data[idx];
  }

  const histogram = new Array(256).fill(0);
  let totalPatterns = 0;

  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1],
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = pixelAt(x, y);
      let pattern = 0;

      offsets.forEach(([dx, dy], i) => {
        const neighbor = pixelAt(x + dx, y + dy);
        if (neighbor >= center) {
          pattern |= (1 << i);
        }
      });

      histogram[pattern]++;
      totalPatterns++;
    }
  }

  // Shannon entropy of the LBP pattern histogram
  let entropy = 0;
  for (const count of histogram) {
    if (count === 0) continue;
    const p = count / totalPatterns;
    entropy -= p * Math.log2(p);
  }

  return { textureEntropy: +entropy.toFixed(3) };
}
/**
 * Patch-based localized anomaly detection.
 *
 * Whole-image contamination % (outlier pixels / total pixels) dilutes
 * localized defects: a small mold spot or bruise only accounts for a
 * tiny fraction of total pixels, so it barely moves a whole-image
 * average even though it's a real, visible defect.
 *
 * This divides the image into a grid of patches, computes the outlier
 * percentage WITHIN each patch separately (relative to the image's
 * overall average color), and reports the WORST patch instead of the
 * whole-image average. A genuinely defective sample should have at
 * least one patch that stands out sharply, even if the rest of the
 * kernel looks completely normal.
 */
function computePatchAnomalyScore(image, globalAvgColor, gridSize = 6) {
  const { width, height, data } = image.bitmap;
  const patchWidth = Math.floor(width / gridSize);
  const patchHeight = Math.floor(height / gridSize);

  const patchScores = [];

  for (let py = 0; py < gridSize; py++) {
    for (let px = 0; px < gridSize; px++) {
      const startX = px * patchWidth;
      const startY = py * patchHeight;
      const endX = (px === gridSize - 1) ? width : startX + patchWidth;
      const endY = (py === gridSize - 1) ? height : startY + patchHeight;

      let outlierCount = 0;
      let totalCount = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const dr = r - globalAvgColor.r;
          const dg = g - globalAvgColor.g;
          const db = b - globalAvgColor.b;
          const distance = Math.sqrt(dr * dr + dg * dg + db * db);

          if (distance > OUTLIER_DISTANCE_THRESHOLD) outlierCount++;
          totalCount++;
        }
      }

      const patchOutlierPercent = totalCount > 0 ? (outlierCount / totalCount) * 100 : 0;
      patchScores.push(+patchOutlierPercent.toFixed(2));
    }
  }

  const maxPatchOutlierPercent = Math.max(...patchScores);
  const meanPatchOutlierPercent = +(patchScores.reduce((a, b) => a + b, 0) / patchScores.length).toFixed(2);

  return { maxPatchOutlierPercent, meanPatchOutlierPercent, patchScores };
}
const OUTLIER_DISTANCE_THRESHOLD = 60; // tune against real sample images
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
    const lbpResult = computeLBPTexture(image);
    const patchResult = computePatchAnomalyScore(image, avgColor);
    const contaminationPercent = +((outlierCount / pixelCount) * 100).toFixed(2);
  const isContaminated = contaminationPercent > CONTAMINATION_PERCENT_THRESHOLD;

  // --- Generate a highlighted version marking contaminated/outlier pixels in red ---
  const highlightedImage = image.clone();
  highlightedImage.scan(0, 0, width, height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const dr = r - avgColor.r;
    const dg = g - avgColor.g;
    const db = b - avgColor.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance > OUTLIER_DISTANCE_THRESHOLD) {
      // Mark this pixel bright red/magenta to highlight the defect
      this.bitmap.data[idx + 0] = 255;
      this.bitmap.data[idx + 1] = 0;
      this.bitmap.data[idx + 2] = 255;
    }
  });
  const highlightedImageBuffer = await highlightedImage.getBuffer('image/jpeg');

  // --- Capture quality gate (secondary - infrastructure, not product QA) ---
  const isTooDark = brightness < 50;
  const isOverexposed = brightness > 220;
  const isBlurry = sharpness < 100; // tune against real sample images
  const captureQualityOk = !isTooDark && !isOverexposed && !isBlurry;

      return {
    width,
    height,
    highlightedImageBuffer,
    // Primary QA signals
    colorDeviationPercent,
    contaminationPercent,
    isContaminated,
    edgeDensityPercent: edgeResult.edgeDensityPercent,
    averageEdgeMagnitude: edgeResult.averageEdgeMagnitude,
        isIrregularEdges: edgeResult.edgeDensityPercent > 3, // calibrated against a real cracked tablet (4.18% edge density)
        textureEntropy: lbpResult.textureEntropy,
    maxPatchContaminationPercent: patchResult.maxPatchOutlierPercent,
    meanPatchContaminationPercent: patchResult.meanPatchOutlierPercent,
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