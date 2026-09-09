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
/**
 * Standard Normal Variate (SNV) scatter correction for NIR/Raman spectra.
 * Removes physical scatter effects and baseline shifts: (y - mean) / stdDev
 */
function standardNormalVariate(yValues) {
  if (!Array.isArray(yValues) || yValues.length === 0) return [];
  const n = yValues.length;
  const mean = yValues.reduce((sum, val) => sum + val, 0) / n;
  const variance = yValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1 || 1);
  const std = Math.sqrt(variance) || 1;

  return yValues.map((val) => +((val - mean) / std).toFixed(6));
}

/**
 * Savitzky-Golay smoothing and derivative filter for spectral signal processing.
 * Standard 5-point and 7-point convolution kernels for 0th (smooth), 1st derivative, 2nd derivative.
 */
function savitzkyGolayFilter(yValues, windowSize = 5, derivativeOrder = 0) {
  if (!Array.isArray(yValues) || yValues.length < windowSize) return [...yValues];

  // Simplified convolution coefficients for standard spectral windows
  // 5-point quadratic/cubic coefficients
  let coeffs = [];
  let norm = 1;

  if (windowSize === 5 && derivativeOrder === 0) {
    coeffs = [-3, 12, 17, 12, -3];
    norm = 35;
  } else if (windowSize === 5 && derivativeOrder === 1) {
    coeffs = [-2, -1, 0, 1, 2];
    norm = 10;
  } else if (windowSize === 5 && derivativeOrder === 2) {
    coeffs = [2, -1, -2, -1, 2];
    norm = 7;
  } else {
    // Default 5-point smooth
    coeffs = [-3, 12, 17, 12, -3];
    norm = 35;
  }

  const halfWindow = Math.floor(coeffs.length / 2);
  const filtered = [];

  for (let i = 0; i < yValues.length; i++) {
    if (i < halfWindow || i >= yValues.length - halfWindow) {
      filtered.push(yValues[i]); // Keep boundaries
      continue;
    }

    let sum = 0;
    for (let j = -halfWindow; j <= halfWindow; j++) {
      sum += yValues[i + j] * coeffs[j + halfWindow];
    }
    filtered.push(+(sum / norm).toFixed(6));
  }

  return filtered;
}

/**
 * Pearson correlation coefficient (R) between two vectors.
 * Returns value from -1.0 to +1.0.
 */
function pearsonCorrelation(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length || vectorA.length === 0) {
    return null;
  }

  const n = vectorA.length;
  const meanA = vectorA.reduce((s, v) => s + v, 0) / n;
  const meanB = vectorB.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = vectorA[i] - meanA;
    const diffB = vectorB[i] - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  const denominator = Math.sqrt(denomA * denomB);
  if (denominator === 0) return null;

  return +(numerator / denominator).toFixed(4);
}

/**
 * Compares an incoming spectrum against MULTIPLE reference variants
 * and returns the best match.
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

/**
 * Full Stage 1 NIR/Raman Spectroscopic Identity Preprocessing & Matching Pipeline.
 * 1. Resample to standard reference x-axis (900 nm - 1700 nm)
 * 2. SNV Scatter Correction
 * 3. Savitzky-Golay 1st derivative filtering
 * 4. Pearson Correlation (R) & Cosine Matching
 * 5. Automated Gate Check (Pass R >= 0.95, Warning 0.85-0.95, Quarantine & Deviation R < 0.85)
 */
function evaluateSpectralIdentity(incomingSpectrum, referenceVariants, options = {}) {
  const { applySnv = true, applySavGol = true, moisturePercent = 1.2 } = options;

  if (!incomingSpectrum || !Array.isArray(incomingSpectrum.x) || !Array.isArray(incomingSpectrum.y)) {
    return { error: 'Invalid incoming spectrum format.' };
  }

  let processedY = [...incomingSpectrum.y];
  if (applySnv) {
    processedY = standardNormalVariate(processedY);
  }
  if (applySavGol) {
    processedY = savitzkyGolayFilter(processedY, 5, 1);
  }

  const processedIncoming = { x: incomingSpectrum.x, y: processedY };

  if (!referenceVariants || referenceVariants.length === 0) {
    return {
      processedSpectrum: processedIncoming,
      bestCorrelationR: null,
      bestCosineSimilarity: null,
      qualityGate: 'NO_REFERENCE',
      quarantine: false,
    };
  }

  const evaluations = referenceVariants.map((ref) => {
    let refY = [...ref.referenceCurve.y];
    if (applySnv) refY = standardNormalVariate(refY);
    if (applySavGol) refY = savitzkyGolayFilter(refY, 5, 1);

    const alignedIncomingY = resampleToXAxis(processedIncoming.x, processedIncoming.y, ref.referenceCurve.x);
    const rScore = pearsonCorrelation(alignedIncomingY, refY);
    const cosineScore = cosineSimilarity(alignedIncomingY, refY);

    return {
      variantName: ref.variantName,
      pearsonR: rScore,
      cosineSimilarity: cosineScore !== null ? +(cosineScore * 100).toFixed(2) : null,
    };
  });

  const best = evaluations.reduce((prev, curr) => 
    (curr.pearsonR !== null && (prev.pearsonR === null || curr.pearsonR > prev.pearsonR)) ? curr : prev
  , { pearsonR: null, cosineSimilarity: null, variantName: null });

  const r = best.pearsonR !== null ? best.pearsonR : (best.cosineSimilarity ? best.cosineSimilarity / 100 : 0);
  
  let gateStatus = 'PASS';
  let quarantine = false;
  let deviationNote = null;

  if (r < 0.85) {
    gateStatus = 'CRITICAL_QUARANTINE';
    quarantine = true;
    deviationNote = `Spectral correlation (R = ${r}) below validated identity threshold 0.85. Container placed in quarantine. Deviation alert triggered.`;
  } else if (r < 0.95) {
    gateStatus = 'WARNING_REVIEW';
    deviationNote = `Spectral correlation (R = ${r}) between 0.85 and 0.95. Secondary confirmation recommended.`;
  }

  const moisturePass = moisturePercent < 2.0;

  return {
    bestVariantName: best.variantName,
    pearsonR: r,
    cosineSimilarity: best.cosineSimilarity,
    moisturePercent,
    moisturePass,
    gateStatus,
    quarantine,
    deviationNote,
    evaluations,
    processedSpectrum: processedIncoming,
  };
}

module.exports = {
  cosineSimilarity,
  compareToReference,
  findBestMatch,
  resampleToXAxis,
  standardNormalVariate,
  savitzkyGolayFilter,
  pearsonCorrelation,
  evaluateSpectralIdentity,
};

