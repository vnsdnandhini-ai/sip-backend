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

module.exports = {
  parseConditionString,
  valueSatisfiesCondition,
  computeDeviation,
  evaluateReading,
};
