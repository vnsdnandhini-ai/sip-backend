/**
 * imageAnalysis.js
 *
 * Basic image quality/consistency checks using Jimp (pure JS, no native deps).
 *
 *  - brightness: average pixel luminance (0-255) - flags too-dark/overexposed captures
 *  - sharpness: Laplacian variance - a standard blur-detection technique;
 *    sharp images have high variance in pixel intensity at edges, blurry
 *    images have low variance
 *  - colorDeviation: Euclidean distance between the image's average RGB and
 *    a reference RGB, expressed as a percentage - flags color/lighting drift
 */

const { Jimp } = require('jimp');
async function analyzeImage(imageBuffer, referenceColor = null) {
  const image = await Jimp.read(imageBuffer);
  const { width, height } = image.bitmap;

  let totalLuminance = 0;
  let sumR = 0, sumG = 0, sumB = 0;
  const grayscale = new Float64Array(width * height);

  image.scan(0, 0, width, height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLuminance += luminance;
    sumR += r; sumG += g; sumB += b;
    grayscale[y * width + x] = luminance;
  });

  const pixelCount = width * height;
  const brightness = +(totalLuminance / pixelCount).toFixed(2);
  const avgColor = {
    r: +(sumR / pixelCount).toFixed(1),
    g: +(sumG / pixelCount).toFixed(1),
    b: +(sumB / pixelCount).toFixed(1),
  };

  // Laplacian variance for blur detection
  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let count = 0;

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
      count++;
    }
  }

  const mean = laplacianSum / count;
  const variance = laplacianSumSq / count - mean * mean;
  const sharpness = +variance.toFixed(2);

  let colorDeviationPercent = null;
  if (referenceColor) {
    const dr = avgColor.r - referenceColor.r;
    const dg = avgColor.g - referenceColor.g;
    const db = avgColor.b - referenceColor.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const maxDistance = Math.sqrt(255 * 255 * 3);
    colorDeviationPercent = +((distance / maxDistance) * 100).toFixed(2);
  }

  return {
    width,
    height,
    brightness,
    isTooDark: brightness < 50,
    isOverexposed: brightness > 220,
    sharpness,
    isBlurry: sharpness < 100, // tune this threshold against real sample images
    avgColor,
    colorDeviationPercent,
  };
}

module.exports = { analyzeImage };