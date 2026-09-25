/**
 * dataAccess.js
 *
 * Replaces the old file-based readData()/writeData() pattern with real
 * database queries. getFullState() reproduces the same shape as the old
 * /api/state endpoint, so the frontend doesn't need to change at all.
 */

const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function getFullState() {
  try {
    const users = await pool.query('SELECT id, username, role FROM users');
    const projects = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    const devices = await pool.query('SELECT * FROM devices');
    const monitoringPoints = await pool.query('SELECT * FROM monitoring_points ORDER BY created_at');
    const parameters = await pool.query('SELECT * FROM parameters ORDER BY created_at');
    const checkoutConditions = await pool.query('SELECT * FROM checkout_conditions ORDER BY created_at');
    const regulatoryRules = await pool.query('SELECT * FROM regulatory_rules ORDER BY created_at');
    const analyticalData = await pool.query(`
      (SELECT * FROM analytical_data WHERE data_type = 'image' OR image_path IS NOT NULL ORDER BY received_at DESC)
      UNION ALL
      (SELECT * FROM analytical_data WHERE (data_type IS NULL OR data_type != 'image') AND image_path IS NULL ORDER BY received_at DESC LIMIT 250)
      ORDER BY received_at DESC
    `);
    const complianceResults = await pool.query('SELECT * FROM compliance_results ORDER BY evaluated_at DESC LIMIT 200');
    const auditTrail = await pool.query('SELECT * FROM audit_trail ORDER BY created_at DESC LIMIT 100');
    const reports = await pool.query('SELECT * FROM reports ORDER BY created_at DESC');
    const dispensingLogs = await pool.query('SELECT * FROM dispensing_logs ORDER BY timestamp DESC LIMIT 100').catch(() => ({ rows: [] }));
    const workflows = await pool.query('SELECT * FROM process_workflows ORDER BY created_at ASC').catch(() => ({ rows: [] }));

  const mappedBatches = projects.rows.map((p) => ({
    id: p.id,
    name: p.name,
    product: p.product,
    batchNumber: p.batch_number,
    department: p.department,
    line: p.line,
    status: p.status,
    materialId: p.material_id || '',
    materialName: p.material_name || '',
    supplier: p.supplier || '',
    targetQuantity: p.target_quantity !== null ? parseFloat(p.target_quantity) : null,
    actualQuantity: p.actual_quantity !== null ? parseFloat(p.actual_quantity) : null,
    weightDeviation: p.weight_deviation !== null ? parseFloat(p.weight_deviation) : null,
    currentStage: p.current_stage || 'Raw Material Receipt',
    qcStatus: p.qc_status || 'In Progress',
    notes: p.notes || '',
    workflowId: p.workflow_id || 'wf-tablet-8step',
    customStages: typeof p.custom_stages === 'string' ? JSON.parse(p.custom_stages) : (p.custom_stages || null),
    createdAt: p.created_at,
  }));

  return {
    users: users.rows,
    projects: mappedBatches,
    batches: mappedBatches, // backward-compatible alias
    devices: devices.rows.map((d) => ({
      deviceId: d.device_id,
      apiKey: d.api_key,
      name: d.name,
      model: d.model || 'In-Line Sensor Unit',
      category: d.category || 'Spectroscopy',
      connectionType: d.connection_type || 'HTTP REST',
      protocol: d.protocol || d.connection_type || 'HTTP REST',
      endpointUrl: d.endpoint_url || 'http://localhost:3000',
      processStage: d.process_stage || 'Raw Material Receipt',
      stationId: d.station_id || 'STATION-01',
      lineName: d.line_name || 'Line 1 (Granulation)',
      monitoringPointId: d.monitoring_point_id,
      capturedParameters: typeof d.captured_parameters === 'string' ? JSON.parse(d.captured_parameters) : (d.captured_parameters || []),
      sampleRate: d.sample_rate || '10s',
      status: d.status || 'active',
      registeredAt: d.registered_at,
      lastSeenAt: d.last_seen_at,
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
      regulatoryRuleId: c.regulatory_rule_id,
    })),
    regulatoryRules: regulatoryRules.rows.map((r) => ({
      id: r.id, name: r.name, description: r.description, status: r.status,
    })),
    analyticalData: analyticalData.rows.map((a) => ({
      id: a.id,
      deviceId: a.device_id,
      monitoringPointId: a.monitoring_point_id,
      projectId: a.project_id,
      batchId: a.project_id,
      processStage: a.process_stage,
      stageStep: a.stage_step,
      defectTags: a.defect_tags,
      sampleMetadata: a.sample_metadata,
      readingType: a.reading_type,
      parameter: a.parameter,
      value: a.value,
      unit: a.unit,
      parameters: a.parameters,
      values: a.values_data,
      receivedAt: a.received_at,
      deviceTimestamp: a.device_timestamp,
      dataType: a.data_type,
      stringValue: a.string_value,
      imagePath: a.image_path,
      imageAnalysis: typeof a.image_analysis === 'string' ? (() => { try { return JSON.parse(a.image_analysis); } catch (e) { return null; } })() : a.image_analysis,
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
      id: r.id,
      content: typeof r.content === 'string' ? JSON.parse(r.content) : r.content,
      integrity: typeof r.integrity === 'string' ? JSON.parse(r.integrity) : r.integrity,
    })),
    dispensingLogs: (dispensingLogs.rows || []).map((d) => ({
      id: d.id,
      batchId: d.batch_id,
      materialId: d.material_id,
      materialName: d.material_name,
      lotNumber: d.lot_number,
      targetQuantity: parseFloat(d.target_quantity),
      actualQuantity: parseFloat(d.actual_quantity),
      deviationPercent: parseFloat(d.deviation_percent),
      operatorName: d.operator_name,
      status: d.status,
      timestamp: d.timestamp,
    })),
    workflows: (workflows.rows || []).map((w) => ({
      id: w.id,
      name: w.name,
      category: w.category,
      description: w.description,
      isDefault: w.is_default,
      stages: typeof w.stages === 'string' ? JSON.parse(w.stages) : (w.stages || []),
      createdAt: w.created_at,
    })),
  };
  } catch (err) {
    console.warn('Database query failed in getFullState, loading local fallback:', err.message);
    try {
      const backupPath = path.join(__dirname, 'local_state_backup.json');
      const dataPath = path.join(__dirname, 'data.json');
      if (fs.existsSync(backupPath)) {
        return JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      } else if (fs.existsSync(dataPath)) {
        return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      }
    } catch (readErr) {
      console.error('Fallback read error:', readErr);
    }
    return { users: [], projects: [], batches: [], devices: [], monitoringPoints: [], parameters: [], checkoutConditions: [], regulatoryRules: [], analyticalData: [], complianceResults: [], auditTrail: [], reports: [], dispensingLogs: [] };
  }
}

module.exports = { pool, getFullState };

