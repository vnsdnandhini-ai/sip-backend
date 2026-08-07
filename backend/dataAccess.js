/**
 * dataAccess.js
 *
 * Replaces the old file-based readData()/writeData() pattern with real
 * database queries. getFullState() reproduces the same shape as the old
 * /api/state endpoint, so the frontend doesn't need to change at all.
 */

const pool = require('./db');

async function getFullState() {
  const [
    users, projects, devices, monitoringPoints, parameters,
    checkoutConditions, regulatoryRules, analyticalData,
    complianceResults, auditTrail, reports,
  ] = await Promise.all([
    pool.query('SELECT id, username, role FROM users'),
    pool.query('SELECT * FROM projects ORDER BY created_at'),
    pool.query('SELECT * FROM devices'),
    pool.query('SELECT * FROM monitoring_points ORDER BY created_at'),
    pool.query('SELECT * FROM parameters ORDER BY created_at'),
    pool.query('SELECT * FROM checkout_conditions ORDER BY created_at'),
    pool.query('SELECT * FROM regulatory_rules ORDER BY created_at'),
    pool.query('SELECT * FROM analytical_data ORDER BY received_at'),
    pool.query('SELECT * FROM compliance_results ORDER BY evaluated_at'),
    pool.query('SELECT * FROM audit_trail ORDER BY created_at DESC'),
    pool.query('SELECT * FROM reports ORDER BY created_at'),
  ]);

  return {
    users: users.rows,
    projects: projects.rows.map((p) => ({
      id: p.id, name: p.name, product: p.product, batchNumber: p.batch_number,
      department: p.department, line: p.line, status: p.status,
    })),
    devices: devices.rows.map((d) => ({
      deviceId: d.device_id, apiKey: d.api_key, name: d.name,
      connectionType: d.connection_type, monitoringPointId: d.monitoring_point_id,
      status: d.status, registeredAt: d.registered_at, lastSeenAt: d.last_seen_at,
    })),
   monitoringPoints: monitoringPoints.rows.map((m) => ({
      id: m.id, name: m.name, location: m.location, frequency: m.frequency,
      description: m.description, status: m.status, projectId: m.project_id,
    })),
    parameters: parameters.rows.map((p) => ({
      id: p.id, name: p.name, monitoringPointId: p.monitoring_point_id,
      instrument: p.instrument, unit: p.unit, frequency: p.frequency, description: p.description,
    })),
    checkoutConditions: checkoutConditions.rows.map((c) => ({
      id: c.id, parameter: c.parameter, monitoringPointId: c.monitoring_point_id,
      acceptance: c.acceptance, warning: c.warning, critical: c.critical, action: c.action,
    })),
    regulatoryRules: regulatoryRules.rows.map((r) => ({
      id: r.id, name: r.name, description: r.description, status: r.status,
    })),
   analyticalData: analyticalData.rows.map((a) => ({
      id: a.id, deviceId: a.device_id, monitoringPointId: a.monitoring_point_id,
      readingType: a.reading_type, parameter: a.parameter, value: a.value, unit: a.unit,
      parameters: a.parameters, values: a.values_data,
      receivedAt: a.received_at, deviceTimestamp: a.device_timestamp,
      dataType: a.data_type, stringValue: a.string_value, imagePath: a.image_path,
      imageAnalysis: a.image_analysis,
    })),
    complianceResults: complianceResults.rows.map((r) => ({
      id: r.id, analyticalDataId: r.analytical_data_id, deviceId: r.device_id,
      monitoringPointId: r.monitoring_point_id, result: r.result, matchedBand: r.matched_band,
      parameter: r.parameter, measuredValue: r.measured_value,
      acceptanceCriteria: r.acceptance_criteria, warningCriteria: r.warning_criteria,
      criticalCriteria: r.critical_criteria, deviation: r.deviation,
      recommendedAction: r.recommended_action, reason: r.reason, evaluatedAt: r.evaluated_at,
    })),
    auditTrail: auditTrail.rows.map((a) => ({
      id: a.id, activity: a.activity, module: a.module, user: a.user_name,
      timestamp: a.created_at,
    })),
  reports: reports.rows.map((r) => ({
      id: r.id, content: JSON.parse(r.content), integrity: JSON.parse(r.integrity),
    })),
  };
}

module.exports = { pool, getFullState };
