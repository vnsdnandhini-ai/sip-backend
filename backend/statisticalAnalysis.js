/**
 * statisticalAnalysis.js
 *
 * Statistical Process Control (SPC) logic - goes beyond simple
 * pass/fail threshold checking. Two real techniques implemented here:
 *
 * 1. Process Capability Index (Cpk) - a standard SPC measure of how
 *    well a process's natural variation fits within its spec limits.
 *    Cpk >= 1.33 is generally considered "capable" in industry practice;
 *    Cpk < 1.0 means the process is not reliably meeting spec even if
 *    the current reading happens to pass.
 *
 * 2. Trend detection (Nelson Rule 5 - "6 points in a row steadily
 *    increasing or decreasing") - flags a process that is drifting
 *    toward a limit, even though every individual reading is still
 *    within the acceptance range. This is the real technique behind
 *    Out-of-Trend (OOT) investigations in pharmaceutical QA.
 */

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values) {
  const m = mean(values);
  const squaredDiffs = values.map((v) => (v - m) ** 2);
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Parses an acceptance range string (e.g. "8-15") into { min, max }.
 * Only handles range format, since Cpk requires both a lower and
 * upper spec limit to be meaningful.
 */
function parseRangeForCpk(acceptanceStr) {
  if (!acceptanceStr) return null;
  const cleaned = String(acceptanceStr).trim().replace(/[%µunitsAUpH]+$/i, '').trim();
  const match = cleaned.match(/^(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)$/);
  if (!match) return null;
  return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
}

/**
 * Calculates the Process Capability Index (Cpk).
 * Cpk = min( (USL - mean) / (3 * sigma), (mean - LSL) / (3 * sigma) )
 * where USL/LSL are the upper/lower spec limits (acceptance range).
 *
 * Interpretation:
 *   Cpk >= 1.33  -> process is capable, comfortably within spec
 *   1.0 <= Cpk < 1.33 -> marginally capable, worth monitoring
 *   Cpk < 1.0    -> process is NOT capable - readings may pass
 *                    individually but the process itself is at risk
 */
function calculateCpk(values, acceptanceStr) {
  const range = parseRangeForCpk(acceptanceStr);
  if (!range || values.length < 2) return null;

  const m = mean(values);
  const sigma = stdDev(values);

  if (sigma === 0) return null; // no variation - Cpk undefined (division by zero)

  const cpkUpper = (range.max - m) / (3 * sigma);
  const cpkLower = (m - range.min) / (3 * sigma);
  const cpk = Math.min(cpkUpper, cpkLower);

  let interpretation;
  if (cpk >= 1.33) interpretation = 'Capable';
  else if (cpk >= 1.0) interpretation = 'Marginally Capable';
  else interpretation = 'Not Capable';

  return {
    cpk: +cpk.toFixed(3),
    mean: +m.toFixed(4),
    stdDev: +sigma.toFixed(4),
    interpretation,
  };
}

/**
 * Detects a sustained trend (Nelson Rule 5): 6 or more consecutive
 * readings that are steadily increasing, or steadily decreasing.
 * Readings must be passed in chronological order (oldest first).
 */
function detectTrend(valuesInChronologicalOrder) {
  const n = valuesInChronologicalOrder.length;
  if (n < 6) {
    return { trendDetected: false, reason: 'Not enough readings for trend analysis (need at least 6).' };
  }

  const recent = valuesInChronologicalOrder.slice(-6);

  let increasing = true;
  let decreasing = true;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] <= recent[i - 1]) increasing = false;
    if (recent[i] >= recent[i - 1]) decreasing = false;
  }

  if (increasing) {
    return {
      trendDetected: true,
      direction: 'increasing',
      reason: 'Last 6 readings are steadily increasing - process may be drifting toward the upper limit even though current readings pass.',
      values: recent,
    };
  }
  if (decreasing) {
    return {
      trendDetected: true,
      direction: 'decreasing',
      reason: 'Last 6 readings are steadily decreasing - process may be drifting toward the lower limit even though current readings pass.',
      values: recent,
    };
  }

  return { trendDetected: false, reason: 'No sustained trend detected in the last 6 readings.' };
}

/**
 * Full SPC analysis for one parameter's historical readings.
 * @param {number[]} valuesInChronologicalOrder - oldest first
 * @param {string} acceptanceStr - e.g. "8-15"
 */
function runStatisticalAnalysis(valuesInChronologicalOrder, acceptanceStr) {
  const capability = calculateCpk(valuesInChronologicalOrder, acceptanceStr);
  const trend = detectTrend(valuesInChronologicalOrder);

  return {
    sampleSize: valuesInChronologicalOrder.length,
    capability,
    trend,
  };
}

module.exports = { mean, stdDev, calculateCpk, detectTrend, runStatisticalAnalysis };
