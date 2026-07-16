/**
 * complianceRoutes.js (database version)
 */

const express = require('express');
const { evaluateReading } = require('./complianceEngine');
const { generateTamperProofReport, verifyReportIntegrity } = require('./tamperProofReports');

module.exports = function (pool, generateId) {
  const router = express.Router();

  async function findMatchingCondition(parameterName, monitoringPointId) {
    const lowerParam = String(parameterName).toLowerCase();

    const scoped = await pool.query(
      'SELECT * FROM checkout_conditions WHERE LOWER(parameter) = $1 AND monitoring_point_id = $2',
      [lowerParam, monitoringPointId]
    );
    if (scoped.rows.length > 0) return scoped.rows[0];

    const global = await pool.query(
      'SELECT * FROM checkout_conditions WHERE LOWER(parameter) = $1 AND monitoring_point_id IS NULL',
      [lowerParam]
    );
    return global.rows[0] || null;
  }

  function toConditionShape(row) {
    if (!row) return null;
    return {
      parameter: row.parameter,
      acceptance: row.acceptance,
      warning: row.warning,
      critical: row.critical,
      action: row.action,
    };
  }

  router.post('/compliance/evaluate-all', async (req, res) => {
    try {
      const alreadyEvaluated = await pool.query('SELECT DISTINCT analytical_data_id FROM compliance_results');
      const evaluatedIds = new Set(alreadyEvaluated.rows.map((r) => r.analytical_data_id));

      const pending = await pool.query('SELECT * FROM analytical_data');
      const newResults = [];

      for (const reading of pending.rows) {
        if (evaluatedIds.has(reading.id)) continue;

        const evaluationTargets = [];
        if (reading.parameters) {
          Object.keys(reading.parameters).forEach((key) => {
            evaluationTargets.push({ parameterName: key, numericValue: parseFloat(reading.parameters[key]) });
          });
        } else if (reading.parameter) {
          evaluationTargets.push({ parameterName: reading.parameter, numericValue: parseFloat(reading.value) });
        }

        for (const { parameterName, numericValue } of evaluationTargets) {
          const conditionRow = await findMatchingCondition(parameterName, reading.monitoring_point_id);
          const evaluation = evaluateReading(numericValue, toConditionShape(conditionRow));

          const id = generateId();
          await pool.query(
            `INSERT INTO compliance_results
             (id, analytical_data_id, device_id, monitoring_point_id, result, matched_band, parameter,
              measured_value, acceptance_criteria, warning_criteria, critical_criteria, deviation,
              recommended_action, reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              id, reading.id, reading.device_id, reading.monitoring_point_id,
              evaluation.result, evaluation.matchedBand || null, evaluation.parameter || parameterName,
              Number.isFinite(evaluation.measuredValue) ? evaluation.measuredValue : numericValue,
              evaluation.acceptanceCriteria || null, evaluation.warningCriteria || null,
              evaluation.criticalCriteria || null,
              evaluation.deviation ? JSON.stringify(evaluation.deviation) : null,
              evaluation.recommendedAction || null, evaluation.reason || null,
            ]
          );
          newResults.push({ id, ...evaluation });
        }
      }

      res.json({ evaluatedCount: newResults.length, results: newResults });
    } catch (err) {
      console.error('Evaluate-all failed:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.delete('/compliance/results', async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM compliance_results RETURNING id');
      res.json({ success: true, cleared: result.rows.length });
    } catch (err) {
      console.error('Failed to clear compliance results:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.delete('/compliance/results/range', async (req, res) => {
    const { startDate, endDate } = req.body;
    try {
      const result = await pool.query(
        `DELETE FROM compliance_results
         WHERE ($1::timestamptz IS NULL OR evaluated_at >= $1)
         AND ($2::timestamptz IS NULL OR evaluated_at <= $2)
         RETURNING id`,
        [startDate || null, endDate || null]
      );
      res.json({ success: true, deleted: result.rows.length });
    } catch (err) {
      console.error('Failed to delete compliance results range:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.post('/reports/generate', async (req, res) => {
    const { title, generatedBy, projectId, dateRangeStart, dateRangeEnd } = req.body;

    try {
      let query = 'SELECT * FROM compliance_results WHERE 1=1';
      const params = [];
      if (dateRangeStart) {
        params.push(dateRangeStart);
        query += ` AND evaluated_at >= $${params.length}`;
      }
      if (dateRangeEnd) {
        params.push(dateRangeEnd);
        query += ` AND evaluated_at <= $${params.length}`;
      }

      const resultsQuery = await pool.query(query, params);
      const resultsInScope = resultsQuery.rows.map((r) => ({
        id: r.id, analyticalDataId: r.analytical_data_id, deviceId: r.device_id,
        monitoringPointId: r.monitoring_point_id, result: r.result, matchedBand: r.matched_band,
        parameter: r.parameter, measuredValue: r.measured_value,
        acceptanceCriteria: r.acceptance_criteria, warningCriteria: r.warning_criteria,
        criticalCriteria: r.critical_criteria, deviation: r.deviation,
        recommendedAction: r.recommended_action, reason: r.reason, evaluatedAt: r.evaluated_at,
      }));

      const monitoringPointsResult = await pool.query('SELECT * FROM monitoring_points');
      const monitoringPointsById = {};
      monitoringPointsResult.rows.forEach((mp) => { monitoringPointsById[mp.id] = mp; });

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

      await pool.query(
        'INSERT INTO reports (id, content, integrity) VALUES ($1,$2,$3)',
        [tamperProofReport.id, JSON.stringify(tamperProofReport.content), JSON.stringify(tamperProofReport.integrity)]
      );

      res.json(tamperProofReport);
    } catch (err) {
      console.error('Report generation failed:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.get('/reports/:id/verify', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM reports WHERE id=$1', [req.params.id]);
      const row = result.rows[0];
      if (!row) return res.status(404).json({ error: 'Report not found.' });

      const report = { id: row.id, content: JSON.parse(row.content), integrity: JSON.parse(row.integrity) };
      const verification = verifyReportIntegrity(report);
      res.json(verification);
    } catch (err) {
      console.error('Verify failed:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  return router;
};
