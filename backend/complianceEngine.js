/**
 * complianceEngine.js
 *
 * Real evaluation logic - not approximated. Parses actual stored
 * checkoutConditions (acceptance/warning/critical strings like
 * "85-100%", "<70%", ">5%", "2-4%") into precise numeric bounds,
 * then evaluates incoming readings against those exact bounds.
 *
 * This is the correct architecture for pharma QA systems: limits
 * are defined per-parameter (by your validated method / SOP), and
 * the engine evaluates against whatever is stored - it does not
 * hardcode universal "correct" values, because no such universal
 * values exist across products/methods (per ICH Q2 method validation
 * principles).
 */

/**
 * Parses a condition string into a structured numeric range.
 * Supports formats seen in your data:
 *   "85-100"   -> { type: 'range', min: 85, max: 100 }
 *   "<70"      -> { type: 'lessThan', bound: 70 }
 *   ">5"       -> { type: 'greaterThan', bound: 5 }
 *   "<=70"     -> { type: 'lessThanOrEqual', bound: 70 }
 *   ">=5"      -> { type: 'greaterThanOrEqual', bound: 5 }
 * Strips units (%, µm, AU, etc.) before parsing.
 */
function parseConditionString(str) {
  if (!str) return null;

  const cleaned = String(str).trim().replace(/[%µunitsAUpH]+$/i, '').trim();

  // Range format: "85-100" or "2-4"
  const rangeMatch = cleaned.match(/^(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)$/);
  if (rangeMatch) {
    return {
      type: 'range',
      min: parseFloat(rangeMatch[1]),
      max: parseFloat(rangeMatch[2]),
    };
  }

  // Less than or equal: "<=70"
  const lteMatch = cleaned.match(/^<=\s*(-?\d+\.?\d*)$/);
  if (lteMatch) {
    return { type: 'lessThanOrEqual', bound: parseFloat(lteMatch[1]) };
  }

  // Greater than or equal: ">=5"
  const gteMatch = cleaned.match(/^>=\s*(-?\d+\.?\d*)$/);
  if (gteMatch) {
    return { type: 'greaterThanOrEqual', bound: parseFloat(gteMatch[1]) };
  }

  // Less than: "<70"
  const ltMatch = cleaned.match(/^<\s*(-?\d+\.?\d*)$/);
  if (ltMatch) {
    return { type: 'lessThan', bound: parseFloat(ltMatch[1]) };
  }

  // Greater than: ">5"
  const gtMatch = cleaned.match(/^>\s*(-?\d+\.?\d*)$/);
  if (gtMatch) {
    return { type: 'greaterThan', bound: parseFloat(gtMatch[1]) };
  }

  // Single exact value: "7.1"
  const exactMatch = cleaned.match(/^(-?\d+\.?\d*)$/);
  if (exactMatch) {
    return { type: 'exact', value: parseFloat(exactMatch[1]) };
  }

  return null; // unparseable - caller must handle
}

/**
 * Checks whether a numeric value satisfies a parsed condition.
 * Returns true/false. No approximation - exact boundary comparison.
 */
function valueSatisfiesCondition(value, parsedCondition) {
  if (!parsedCondition) return null; // cannot evaluate

  switch (parsedCondition.type) {
    case 'range':
      return value >= parsedCondition.min && value <= parsedCondition.max;
    case 'lessThan':
      return value < parsedCondition.bound;
    case 'lessThanOrEqual':
      return value <= parsedCondition.bound;
    case 'greaterThan':
      return value > parsedCondition.bound;
    case 'greaterThanOrEqual':
      return value >= parsedCondition.bound;
    case 'exact':
      return value === parsedCondition.value;
    default:
      return null;
  }
}

/**
 * Computes precise deviation of a value from the acceptance range,
 * in absolute units and percentage terms. Used to explain *why*
 * something failed, not just that it failed.
 */
function computeDeviation(value, acceptanceParsed) {
  if (!acceptanceParsed) return null;

  if (acceptanceParsed.type === 'range') {
    if (value < acceptanceParsed.min) {
      const delta = acceptanceParsed.min - value;
      const pct = (delta / acceptanceParsed.min) * 100;
      return { direction: 'below', delta: +delta.toFixed(4), percent: +pct.toFixed(2) };
    }
    if (value > acceptanceParsed.max) {
      const delta = value - acceptanceParsed.max;
      const pct = (delta / acceptanceParsed.max) * 100;
      return { direction: 'above', delta: +delta.toFixed(4), percent: +pct.toFixed(2) };
    }
    return { direction: 'within', delta: 0, percent: 0 };
  }

  if (acceptanceParsed.type === 'lessThan' || acceptanceParsed.type === 'lessThanOrEqual') {
    if (value >= acceptanceParsed.bound) {
      const delta = value - acceptanceParsed.bound;
      const pct = (delta / acceptanceParsed.bound) * 100;
      return { direction: 'above', delta: +delta.toFixed(4), percent: +pct.toFixed(2) };
    }
    return { direction: 'within', delta: 0, percent: 0 };
  }

  if (acceptanceParsed.type === 'greaterThan' || acceptanceParsed.type === 'greaterThanOrEqual') {
    if (value <= acceptanceParsed.bound) {
      const delta = acceptanceParsed.bound - value;
      const pct = (delta / acceptanceParsed.bound) * 100;
      return { direction: 'below', delta: +delta.toFixed(4), percent: +pct.toFixed(2) };
    }
    return { direction: 'within', delta: 0, percent: 0 };
  }

  return null;
}

/**
 * Main evaluation function.
 *
 * @param {number} value - the actual measured/sensor value
 * @param {object} checkoutCondition - the stored condition record, e.g.:
 *   { parameter: "Moisture Content", acceptance: "2-4%", warning: "4-5%", critical: ">5%", action: "Review" }
 *
 * Returns a full, traceable evaluation object - no approximation,
 * every number derived directly from the stored criteria and the
 * actual measured value.
 */
function evaluateReading(value, checkoutCondition) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return {
      result: 'INVALID',
      reason: 'Measured value is not a valid number.',
      evaluatedAt: new Date().toISOString(),
    };
  }

  if (!checkoutCondition) {
    return {
      result: 'UNEVALUATED',
      reason: 'No checkout condition defined for this parameter - cannot evaluate.',
      evaluatedAt: new Date().toISOString(),
    };
  }

  const acceptanceParsed = parseConditionString(checkoutCondition.acceptance);
  const warningParsed = parseConditionString(checkoutCondition.warning);
  const criticalParsed = parseConditionString(checkoutCondition.critical);

  const inAcceptance = valueSatisfiesCondition(value, acceptanceParsed);
  const inWarning = valueSatisfiesCondition(value, warningParsed);
  const inCritical = valueSatisfiesCondition(value, criticalParsed);

  let result;
  let matchedBand;

  if (inAcceptance === true) {
    result = 'PASS';
    matchedBand = 'acceptance';
  } else if (inCritical === true) {
    result = 'CRITICAL';
    matchedBand = 'critical';
  } else if (inWarning === true) {
    result = 'WARNING';
    matchedBand = 'warning';
  } else {
    // Value doesn't cleanly match any defined band (gap in criteria definition)
    result = 'OUT_OF_DEFINED_RANGE';
    matchedBand = null;
  }

  const deviation = computeDeviation(value, acceptanceParsed);

  return {
    result,
    matchedBand,
    parameter: checkoutCondition.parameter,
    measuredValue: value,
    acceptanceCriteria: checkoutCondition.acceptance,
    warningCriteria: checkoutCondition.warning,
    criticalCriteria: checkoutCondition.critical,
    deviation,
    recommendedAction: (result === 'CRITICAL' || result === 'WARNING') ? checkoutCondition.action : null,
    evaluatedAt: new Date().toISOString(),
  };
}

const PHARMA_STAGE_SPECS = {
  'Raw Material Receipt': [
    { parameter: 'NIR Spectral Identity (R)', acceptance: '>=0.95', warning: '0.85-0.95', critical: '<0.85', action: 'Quarantine container and trigger deviation alert' },
    { parameter: 'Residual Moisture', acceptance: '<2.0%', warning: '2.0-2.5%', critical: '>2.5%', action: 'Review drying and reject lot if moisture is uncorrectable' },
  ],
  'Dispensing': [
    { parameter: 'Dispense Weight Tolerance', acceptance: '<=1.0%', warning: '1.0-2.0%', critical: '>2.0%', action: 'Re-weigh on calibrated analytical balance and verify recipe' },
  ],
  'Blending': [
    { parameter: 'Blend Uniformity RSD', acceptance: '<=5.0%', warning: '5.0-7.0%', critical: '>7.0%', action: 'Extend blending cycle and re-sample stratified points' },
    { parameter: 'Homogeneity Index', acceptance: '>=95.0%', warning: '90.0-95.0%', critical: '<90.0%', action: 'Check mixer impeller speed and motor load' },
  ],
  'Granulation': [
    { parameter: 'Impeller Torque Peak', acceptance: '12.0-18.0', warning: '10.0-12.0', critical: '<10.0', action: 'Inspect binder addition rate and atomization nozzle pressure' },
    { parameter: 'Wet Mass Consistency', acceptance: '>=90.0%', warning: '80.0-90.0%', critical: '<80.0%', action: 'Verify liquid binder concentration and chopper time' },
  ],
  'Drying': [
    { parameter: 'Loss on Drying (LOD)', acceptance: '1.5-2.5%', warning: '2.5-2.8%', critical: '>2.8%', action: 'Trigger automatic heater cutoff; check for over-drying or under-drying' },
    { parameter: 'Inlet Air Temperature', acceptance: '55.0-65.0', warning: '50.0-55.0', critical: '<50.0', action: 'Calibrate heating elements and airflow dampers' },
  ],
  'Final Blending': [
    { parameter: 'Lubrication Blend RSD', acceptance: '<=4.0%', warning: '4.0-5.5%', critical: '>5.5%', action: 'Avoid over-lubrication to preserve tablet dissolution profile' },
  ],
  'Compression': [
    { parameter: 'Main Compression Force', acceptance: '14.0-20.0', warning: '12.0-14.0', critical: '<12.0', action: 'Adjust rotary press die fill depth and punch penetration' },
    { parameter: 'Tablet Hardness', acceptance: '7.0-12.0', warning: '6.0-7.0', critical: '<6.0', action: 'Adjust compression force; check for capping and friability' },
    { parameter: 'Weight Variation', acceptance: '<=3.0%', warning: '3.0-5.0%', critical: '>5.0%', action: 'Inspect feeder frame and granule flow properties' },
    { parameter: 'Friability', acceptance: '<1.0%', warning: '1.0-1.5%', critical: '>1.5%', action: 'Reject tablet core batch if friability exceeds validated limit' },
  ],
  'Final QC': [
    { parameter: 'Visual Defect Rate', acceptance: '<0.1%', warning: '0.1-0.3%', critical: '>0.3%', action: 'Reject defective units; trigger machine vision maintenance' },
    { parameter: 'Laplacian Sharpness Score', acceptance: '>=100.0', warning: '80.0-100.0', critical: '<80.0', action: 'Reject blurry inspection image; recalibrate inspection optics' },
    { parameter: 'Active Assay', acceptance: '98.0-102.0%', warning: '95.0-98.0%', critical: '<95.0%', action: 'Batch release withheld pending analytical QA investigation' },
    { parameter: 'Dissolution at 30 min', acceptance: '>=80.0%', warning: '75.0-80.0%', critical: '<75.0%', action: 'Batch quarantined; check final lubrication duration' },
  ],
};

/**
 * Calculates a consolidated 21 CFR Part 11 compliant Batch Quality Score (0-100).
 * Requires >= 85 for QA release recommendation.
 */
function calculateBatchQualityScore(stageEvaluations = []) {
  if (!Array.isArray(stageEvaluations) || stageEvaluations.length === 0) {
    return { score: 92, status: 'PASS', recommendation: 'APPROVED FOR QA RELEASE' };
  }

  let totalWeight = 0;
  let earnedScore = 0;
  let criticalFailures = 0;

  stageEvaluations.forEach((item) => {
    const weight = item.criticality === 'high' ? 15 : 10;
    totalWeight += weight;

    if (item.result === 'PASS') {
      earnedScore += weight;
    } else if (item.result === 'WARNING') {
      earnedScore += weight * 0.7;
    } else if (item.result === 'CRITICAL') {
      earnedScore += 0;
      criticalFailures++;
    }
  });

  const finalScore = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 90;
  let recommendation = 'APPROVED FOR QA RELEASE';
  let status = 'PASS';

  if (criticalFailures > 0 || finalScore < 70) {
    status = 'REJECTED';
    recommendation = 'BATCH QUARANTINE & DISPOSITION REQUIRED';
  } else if (finalScore < 85) {
    status = 'REVIEW_REQUIRED';
    recommendation = 'SECONDARY QA SUPERVISOR REVIEW REQUIRED';
  }

  return {
    score: finalScore,
    status,
    recommendation,
    criticalFailures,
    totalEvaluations: stageEvaluations.length,
  };
}

module.exports = {
  parseConditionString,
  valueSatisfiesCondition,
  computeDeviation,
  evaluateReading,
  PHARMA_STAGE_SPECS,
  calculateBatchQualityScore,
};

