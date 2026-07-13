/**
 * complianceRoutes.js
 *
 * Wires the compliance engine and tamper-proof report generator into
 * your Express app.
 *
 * UPDATED: checkout conditions can now be scoped to a specific
 * monitoring point. When evaluating a reading, the engine first looks
 * for a condition matching BOTH the parameter name AND the reading's
 * monitoringPointId. If none exists, it falls back to a "global"
 * condition (one with no monitoringPointId set) for that parameter,
 * so existing conditions keep working without changes.
 */

const express = require('express');
const { evaluateReading } = require('./complianceEngine');
const { generateTamperProofReport, verifyReportIntegrity } = require('./tamperProofReports');

module.exports = function (readData, writeData, generateId) {
  const router = express.Router();

  function findMatchingCondition(checkoutConditions, parameterName, monitoringPointId) {
    const lowerParam = String(parameterName).toLowerCase();

    // Prefer a condition scoped to this exact monitoring point
    const scoped = checkoutConditions.find(
      (c) => c.parameter.toLowerCase() === lowerParam && c.monitoringPointId === monitoringPointId
    );
    if (scoped) return scoped;

    // Fall back to a global condition (no monitoringPointId set) for this parameter
    const global = checkoutConditions.find(
      (c) => c.parameter.toLowerCase() === lowerParam && !c.monitoringPointId
    );
    return global || null;
  }

  router.post('/compliance/evaluate', (req, res) => {
    const { analyticalDataId } = req.body;
    if (!analyticalDataId) {
      return res.status(400).json({ error: 'analyticalDataId is required.' });
    }

    const data = readData();
    const reading = data.analyticalData.find((item) => item.id === analyticalDataId);
    if (!reading) {
      return res.status(404).json({ error: 'Analytical data record not found.' });
    }

    let parameterName = reading.parameter;
    let numericValue = parseFloat(reading.value);

    if (reading.parameters && typeof reading.parameters === 'object') {
      const candidateKeys = Object.keys(reading.parameters);
      for (const key of candidateKeys) {
        const match = findMatchingCondition(data.checkoutConditions, key, reading.monitoringPointId);
        if (match) {
          parameterName = match.parameter;
          numericValue = parseFloat(reading.parameters[key]);
          break;
        }
      }
    }

    const checkoutCondition = findMatchingCondition(data.checkoutConditions, parameterName, reading.monitoringPointId);
    const evaluation = evaluateReading(numericValue, checkoutCondition);

    const complianceResult = {
      id: generateId(),
      analyticalDataId: reading.id,
      deviceId: reading.deviceId || null,
      monitoringPointId: reading.monitoringPointId || null,
      ...evaluation,
    };

    data.complianceResults.push(complianceResult);
    writeData(data);

    res.json(complianceResult);
  });

  router.post('/compliance/evaluate-all', (req, res) => {
    const data = readData();

    const alreadyEvaluatedIds = new Set(data.complianceResults.map((r) => r.analyticalDataId));
    const pending = data.analyticalData.filter((item) => !alreadyEvaluatedIds.has(item.id));

    const newResults = [];

    pending.forEach((reading) => {
      const evaluationTargets = [];

      if (reading.parameters && typeof reading.parameters === 'object') {
        Object.keys(reading.parameters).forEach((key) => {
          evaluationTargets.push({
            parameterName: key,
            numericValue: parseFloat(reading.parameters[key]),
          });
        });
      } else {
        evaluationTargets.push({
          parameterName: reading.parameter,
          numericValue: parseFloat(reading.value),
        });
      }

      evaluationTargets.forEach(({ parameterName, numericValue }) => {
        const checkoutCondition = findMatchingCondition(data.checkoutConditions, parameterName, reading.monitoringPointId);
        const evaluation = evaluateReading(numericValue, checkoutCondition);

        const complianceResult = {
          id: generateId(),
          analyticalDataId: reading.id,
          deviceId: reading.deviceId || null,
          monitoringPointId: reading.monitoringPointId || null,
          ...evaluation,
        };

        data.complianceResults.push(complianceResult);
        newResults.push(complianceResult);
      });
    });

    writeData(data);
    res.json({ evaluatedCount: newResults.length, results: newResults });
  });

  router.post('/reports/generate', (req, res) => {
    const { title, generatedBy, projectId, dateRangeStart, dateRangeEnd } = req.body;

    const data = readData();

    let resultsInScope = data.complianceResults;
    if (dateRangeStart || dateRangeEnd) {
      resultsInScope = resultsInScope.filter((r) => {
        const t = new Date(r.evaluatedAt).getTime();
        if (dateRangeStart && t < new Date(dateRangeStart).getTime()) return false;
        if (dateRangeEnd && t > new Date(dateRangeEnd).getTime()) return false;
        return true;
      });
    }

    // Group results by monitoring point for the report
    const monitoringPointsById = {};
    (data.monitoringPoints || []).forEach((mp) => { monitoringPointsById[mp.id] = mp; });

    const byMonitoringPoint = {};
    resultsInScope.forEach((r) => {
      const key = r.monitoringPointId || 'unassigned';
      if (!byMonitoringPoint[key]) {
        byMonitoringPoint[key] = {
          monitoringPointId: r.monitoringPointId || null,
          monitoringPointName: monitoringPointsById[r.monitoringPointId]?.name || 'Unassigned / Not linked to a monitoring point',
          results: [],
        };
      }
      byMonitoringPoint[key].results.push(r);
    });

    const summary = {
      totalEvaluated: resultsInScope.length,
      pass: resultsInScope.filter((r) => r.result === 'PASS').length,
      warning: resultsInScope.filter((r) => r.result === 'WARNING').length,
      critical: resultsInScope.filter((r) => r.result === 'CRITICAL').length,
      invalidOrUnevaluated: resultsInScope.filter(
        (r) => r.result === 'INVALID' || r.result === 'UNEVALUATED' || r.result === 'OUT_OF_DEFINED_RANGE'
      ).length,
    };

    const reportContent = {
      title: title || 'Compliance Report',
      generatedBy: generatedBy || 'system',
      projectId: projectId || null,
      dateRangeStart: dateRangeStart || null,
      dateRangeEnd: dateRangeEnd || null,
      summary,
      byMonitoringPoint: Object.values(byMonitoringPoint),
      results: resultsInScope,
    };

    const tamperProofReport = generateTamperProofReport(reportContent);

    data.reports.push(tamperProofReport);
    writeData(data);

    res.json(tamperProofReport);
  });

  router.get('/reports/:id/verify', (req, res) => {
    const data = readData();
    const report = data.reports.find((r) => r.id === req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const verification = verifyReportIntegrity(report);
    res.json(verification);
  });

  return router;
};
