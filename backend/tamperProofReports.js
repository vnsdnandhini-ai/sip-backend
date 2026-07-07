/**
 * tamperProofReports.js
 *
 * Real tamper-evidence, not a UI badge that says "verified".
 * Uses Node's built-in crypto module to generate a SHA-256 hash of
 * the exact report content at generation time. Any modification to
 * the report afterward changes its hash, which is detectable by
 * recomputing and comparing against the stored hash.
 *
 * This is the same principle used in real 21 CFR Part 11 compliant
 * systems (electronic record integrity via cryptographic checksums).
 */

const crypto = require('crypto');

/**
 * Deterministically serializes an object so the same data always
 * produces the same hash (JSON.stringify with sorted keys - plain
 * JSON.stringify is NOT safe here because key order isn't guaranteed
 * to be identical across different code paths).
 */
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalize).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Generates a SHA-256 hash of the given report content.
 * Returns a hex string, e.g. "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3"
 */
function generateHash(reportContent) {
  const canonical = canonicalize(reportContent);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Builds a finalized, tamper-evident report record.
 *
 * @param {object} reportContent - the actual report data (readings,
 *   evaluations, project info, generated-by, date range, etc.)
 * @returns {object} - the report wrapped with integrity metadata
 */
function generateTamperProofReport(reportContent) {
  const generatedAt = new Date().toISOString();

  const fullContent = {
    ...reportContent,
    generatedAt,
  };

  const contentHash = generateHash(fullContent);

  return {
    id: `report-${crypto.randomBytes(8).toString('hex')}`,
    content: fullContent,
    integrity: {
      algorithm: 'SHA-256',
      hash: contentHash,
      generatedAt,
    },
  };
}

/**
 * Verifies whether a stored report has been tampered with, by
 * recomputing the hash of its current content and comparing against
 * the hash that was stored at generation time.
 *
 * @param {object} storedReport - a report object as produced by
 *   generateTamperProofReport (and possibly since modified)
 * @returns {object} - { valid: boolean, expectedHash, actualHash }
 */
function verifyReportIntegrity(storedReport) {
  if (!storedReport || !storedReport.content || !storedReport.integrity) {
    return {
      valid: false,
      reason: 'Report is missing content or integrity metadata.',
    };
  }

  const recomputedHash = generateHash(storedReport.content);
  const valid = recomputedHash === storedReport.integrity.hash;

  return {
    valid,
    expectedHash: storedReport.integrity.hash,
    actualHash: recomputedHash,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateHash,
  generateTamperProofReport,
  verifyReportIntegrity,
};
