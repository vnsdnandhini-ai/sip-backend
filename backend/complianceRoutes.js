/**
 * complianceRoutes.js
 *
 * Wires the compliance engine and tamper-proof report generator into
 * your Express app. Mount alongside your existing sensorRoutes.
 *
 * Usage in server.js:
 *   const complianceRoutes = require('./complianceRoutes');
 *   app.use('/api', complianceRoutes(readData, writeData, generateId));
 */

const express = require('express');
const { evaluateReading } = require('./complianceEngine');
const { generateTamperProofReport, verifyReportIntegrity } = require('./tamperProofReports');

module.exports = function (readData, writeData, generateId) {
  const router = express.Router();

  // --- Evaluate a single analyticalData record against its checkoutCondition ---
  // POST body: { analyticalDataId: "..." }
  // Finds the reading, finds a matching checkoutCondition by parameter
  // name, runs the real evaluation logic, and stores the result in
  // complianceResults (never overwrites the raw reading - raw data stays
  // as originally recorded, per data integrity principles).
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

    // Determine the numeric value to evaluate.
    // Supports both the manual-entry shape (item.value, item.parameter)
    // and the sensor-ingestion shape (item.parameters = { concentration, temperature, ... }).
    let parameterName = reading.parameter;
    let numericValue = parseFloat(reading.value);

    if (reading.parameters && typeof reading.parameters === 'object') {
      // Sensor readings can carry multiple parameters at once - evaluate the first one
      // that has a matching checkoutCondition, or require the caller to specify which.
      const candidateKeys = Object.keys(reading.parameters);
      for (const key of candidateKeys) {
        const match = data.checkoutConditions.find(
          (c) => c.parameter.toLowerCase() === key.toLowerCase()
        );
        if (match) {
          parameterName = match.parameter;
          numericValue = parseFloat(reading.parameters[key]);
          break;
        }
      }
    }

    const checkoutCondition = data.checkoutConditions.find(
      (c) => c.parameter.toLowerCase() === String(parameterName).toLowerCase()
    );

    const evaluation = evaluateReading(numericValue, checkoutCondition);

    const complianceResult = {
      id: generateId(),
      analyticalDataId: reading.id,
      deviceId: reading.deviceId || null,
      ...evaluation,
    };

    data.complianceResults.push(complianceResult);
    writeData(data);

    res.json(complianceResult);
  });

  // --- Evaluate ALL analyticalData records that haven't been evaluated yet ---
  router.post('/compliance/evaluate-all', (req, res) => {
    const data = readData();

    const alreadyEvaluatedIds = new Set(data.complianceResults.map((r) => r.analyticalDataId));
    const pending = data.analyticalData.filter((item) => !alreadyEvaluatedIds.has(item.id));

    const newResults = [];

    pending.forEach((reading) => {
      // Build a list of { parameterName, numericValue } pairs to evaluate.
      // Manual-entry readings have exactly one (item.parameter / item.value).
      // Sensor readings can carry multiple parameters at once (e.g.
      // concentration AND temperature in the same reading) - evaluate
      // every one of them, not just the first match.
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
        const checkoutCondition = data.checkoutConditions.find(
          (c) => c.parameter.toLowerCase() === String(parameterName).toLowerCase()
        );

        const evaluation = evaluateReading(numericValue, checkoutCondition);

        const complianceResult = {
          id: generateId(),
          analyticalDataId: reading.id,
          deviceId: reading.deviceId || null,
          ...evaluation,
        };

        data.complianceResults.push(complianceResult);
        newResults.push(complianceResult);
      });
    });

    writeData(data);
    res.json({ evaluatedCount: newResults.length, results: newResults });
  });

  // --- Generate a tamper-proof report from current compliance results ---
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
      results: resultsInScope,
    };

    const tamperProofReport = generateTamperProofReport(reportContent);

    data.reports.push(tamperProofReport);
    writeData(data);

    res.json(tamperProofReport);
  });

  // --- Verify a report hasn't been tampered with ---
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
