/**
 * spectrumSimilarity.js
 *
 * Computes similarity between an incoming spectral curve and one or
 * more reference spectra, using cosine similarity - a standard
 * technique for comparing the SHAPE of two curves independent of
 * their absolute magnitude (important for spectroscopy, where
 * intensity can vary with sample concentration/instrument gain while
 * the underlying spectral shape/fingerprint stays the same).
 *
 * A spectrum is represented as: { x: [wavelengths...], y: [intensities...] }
 *
 * SUPPORTS MULTIPLE REFERENCE VARIANTS: an incoming spectrum is
 * compared against every active reference for that parameter, and
 * the BEST (highest) similarity score is used - so a sample matching
 * any one of several acceptable reference profiles (e.g. different
 * approved suppliers) is correctly recognized as a match.
 */

/**
 * Resamples one curve onto another curve's x-axis using simple linear
 * interpolation. Real spectra from different instruments/scans often
 * don't share identical x-axis points, so this aligns them before
 * comparing. Assumes both x arrays are sorted ascending.
 */
function resampleToXAxis(sourceX, sourceY, targetX) {
  const resampledY = [];

  for (const tx of targetX) {
    if (tx <= sourceX[0]) {
      resampledY.push(sourceY[0]);
      continue;
    }
    if (tx >= sourceX[sourceX.length - 1]) {
      resampledY.push(sourceY[sourceY.length - 1]);
      continue;
    }

    // Find the two source points that bracket this target x value
    let i = 0;
    while (i < sourceX.length - 1 && sourceX[i + 1] < tx) i++;

    const x0 = sourceX[i];
    const x1 = sourceX[i + 1];
    const y0 = sourceY[i];
    const y1 = sourceY[i + 1];

    // Linear interpolation
    const t = (tx - x0) / (x1 - x0);
    resampledY.push(y0 + t * (y1 - y0));
  }

  return resampledY;
}

/**
 * Cosine similarity between two equal-length numeric vectors.
 * Returns a value from -1 to 1 (typically 0 to 1 for spectral data,
 * since intensities are non-negative). 1 = identical shape.
 */
function cosineSimilarity(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length || vectorA.length === 0) return null;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] ** 2;
    magnitudeB += vectorB[i] ** 2;
  }

  if (magnitudeA === 0 || magnitudeB === 0) return null;

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

/**
 * Compares an incoming spectrum against a single reference spectrum,
 * resampling as needed, and returns a similarity percentage (0-100).
 */
function compareToReference(incomingSpectrum, referenceSpectrum) {
  const alignedIncomingY = resampleToXAxis(
    incomingSpectrum.x, incomingSpectrum.y, referenceSpectrum.x
  );

  const similarity = cosineSimilarity(alignedIncomingY, referenceSpectrum.y);
  if (similarity === null) return null;

  return +(Math.max(0, similarity) * 100).toFixed(2);
}

/**
 * Compares an incoming spectrum against MULTIPLE reference variants
 * and returns the best match. This is the core "multiple allowed
 * variations" logic - a sample is considered a match if it's similar
 * enough to ANY approved reference profile, not just one fixed curve.
 *
 * @param {object} incomingSpectrum - { x: [...], y: [...] }
 * @param {Array} referenceVariants - [{ variantName, referenceCurve: {x,y} }, ...]
 * @returns {object} - { bestSimilarity, bestVariantName, allScores }
 */
function findBestMatch(incomingSpectrum, referenceVariants) {
  if (!referenceVariants || referenceVariants.length === 0) {
    return { bestSimilarity: null, bestVariantName: null, allScores: [] };
  }

  const allScores = referenceVariants.map((variant) => ({
    variantName: variant.variantName,
    similarity: compareToReference(incomingSpectrum, variant.referenceCurve),
  }));

  const validScores = allScores.filter((s) => s.similarity !== null);
  if (validScores.length === 0) {
    return { bestSimilarity: null, bestVariantName: null, allScores };
  }

  const best = validScores.reduce((max, curr) => (curr.similarity > max.similarity ? curr : max));

  return {
    bestSimilarity: best.similarity,
    bestVariantName: best.variantName,
    allScores,
  };
}

module.exports = { cosineSimilarity, compareToReference, findBestMatch, resampleToXAxis };
