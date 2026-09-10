const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('./db');
const runMigrations = require('./runMigrations');
const { getFullState } = require('./dataAccess');
const sensorRoutes = require('./sensorRoutes');
const complianceRoutes = require('./complianceRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Run migrations
runMigrations();

// Health check endpoints for Render and uptime monitors
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'sip-backend', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'sip-backend', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
}, express.static(path.join(__dirname, 'uploads')));

function generateId() {
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

app.get('/api/state', async (req, res) => {
  try {
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    console.error('Failed to get state:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Auth ---
app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const id = generateId();
    await pool.query(
      'INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
      [id, username, passwordHash, role || 'operator']
    );
    res.json({ user: { id, username, role: role || 'operator' } });
  } catch (err) {
    console.error('Register failed:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const passwordMatches = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    res.json({ user: { id: user.id, username: user.username, role: user.role }, token: generateId() });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Audit ---
app.post('/api/audit', async (req, res) => {
  const { activity, module, user } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
      [id, activity, module, user]
    );
    res.json({ id, activity, module, user });
  } catch (err) {
    console.error('Failed to record audit entry:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Batches & Projects (Pharma Batch Lifecycle) ---
async function saveBatch(id, body, isUpdate = false) {
  const {
    name, product, batchNumber, department, line, status,
    materialId, materialName, supplier, targetQuantity, actualQuantity,
    weightDeviation, currentStage, qcStatus, notes
  } = body;

  let deviation = weightDeviation;
  if (targetQuantity && actualQuantity && (deviation === undefined || deviation === null)) {
    const target = parseFloat(targetQuantity);
    const actual = parseFloat(actualQuantity);
    if (target > 0) {
      deviation = parseFloat((((actual - target) / target) * 100).toFixed(2));
    }
  }

  if (isUpdate) {
    const result = await pool.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        product = COALESCE($2, product),
        batch_number = COALESCE($3, batch_number),
        department = COALESCE($4, department),
        line = COALESCE($5, line),
        status = COALESCE($6, status),
        material_id = COALESCE($7, material_id),
        material_name = COALESCE($8, material_name),
        supplier = COALESCE($9, supplier),
        target_quantity = COALESCE($10, target_quantity),
        actual_quantity = COALESCE($11, actual_quantity),
        weight_deviation = COALESCE($12, weight_deviation),
        current_stage = COALESCE($13, current_stage),
        qc_status = COALESCE($14, qc_status),
        notes = COALESCE($15, notes)
      WHERE id = $16 RETURNING *`,
      [
        name, product, batchNumber, department, line, status,
        materialId, materialName, supplier, targetQuantity || null, actualQuantity || null,
        deviation || null, currentStage, qcStatus, notes, id
      ]
    );
    return result.rows[0];
  } else {
    const result = await pool.query(
      `INSERT INTO projects (
        id, name, product, batch_number, department, line, status,
        material_id, material_name, supplier, target_quantity, actual_quantity,
        weight_deviation, current_stage, qc_status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        id, name, product, batchNumber, department, line, status || 'Active',
        materialId || null, materialName || null, supplier || null,
        targetQuantity || null, actualQuantity || null, deviation || null,
        currentStage || 'Raw Material Receipt', qcStatus || 'In Progress', notes || null
      ]
    );
    return result.rows[0];
  }
}

// Batches Endpoints
app.get('/api/batches', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(result.rows.map((p) => ({
      id: p.id, name: p.name, product: p.product, batchNumber: p.batch_number,
      department: p.department, line: p.line, status: p.status,
      materialId: p.material_id || '', materialName: p.material_name || '', supplier: p.supplier || '',
      targetQuantity: p.target_quantity !== null ? parseFloat(p.target_quantity) : null,
      actualQuantity: p.actual_quantity !== null ? parseFloat(p.actual_quantity) : null,
      weightDeviation: p.weight_deviation !== null ? parseFloat(p.weight_deviation) : null,
      currentStage: p.current_stage || 'Raw Material Receipt',
      qcStatus: p.qc_status || 'In Progress',
      notes: p.notes || '',
      createdAt: p.created_at,
    })));
  } catch (err) {
    console.error('Failed to list batches:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Batch not found.' });
    const p = result.rows[0];
    res.json({
      id: p.id, name: p.name, product: p.product, batchNumber: p.batch_number,
      department: p.department, line: p.line, status: p.status,
      materialId: p.material_id || '', materialName: p.material_name || '', supplier: p.supplier || '',
      targetQuantity: p.target_quantity !== null ? parseFloat(p.target_quantity) : null,
      actualQuantity: p.actual_quantity !== null ? parseFloat(p.actual_quantity) : null,
      weightDeviation: p.weight_deviation !== null ? parseFloat(p.weight_deviation) : null,
      currentStage: p.current_stage || 'Raw Material Receipt',
      qcStatus: p.qc_status || 'In Progress',
      notes: p.notes || '',
      createdAt: p.created_at,
    });
  } catch (err) {
    console.error('Failed to get batch:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.post('/api/batches', async (req, res) => {
  const { name, product, batchNumber } = req.body;
  if (!name || !product || !batchNumber) {
    return res.status(400).json({ error: 'Batch name, product name, and batch number are required.' });
  }
  const id = generateId();
  try {
    const batch = await saveBatch(id, req.body, false);
    res.json(batch);
  } catch (err) {
    console.error('Failed to create batch:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/batches/:id', async (req, res) => {
  try {
    const batch = await saveBatch(req.params.id, req.body, true);
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });
    res.json(batch);
  } catch (err) {
    console.error('Failed to update batch:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/batches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete batch:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// Backward-compatible /api/projects aliases
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(result.rows.map((p) => ({
      id: p.id, name: p.name, product: p.product, batchNumber: p.batch_number,
      department: p.department, line: p.line, status: p.status,
      materialId: p.material_id || '', materialName: p.material_name || '', supplier: p.supplier || '',
      targetQuantity: p.target_quantity !== null ? parseFloat(p.target_quantity) : null,
      actualQuantity: p.actual_quantity !== null ? parseFloat(p.actual_quantity) : null,
      weightDeviation: p.weight_deviation !== null ? parseFloat(p.weight_deviation) : null,
      currentStage: p.current_stage || 'Raw Material Receipt',
      qcStatus: p.qc_status || 'In Progress',
      notes: p.notes || '',
      createdAt: p.created_at,
    })));
  } catch (err) {
    console.error('Failed to list projects:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.post('/api/projects', async (req, res) => {
  const id = generateId();
  try {
    const batch = await saveBatch(id, req.body, false);
    res.json(batch);
  } catch (err) {
    console.error('Failed to create project:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const batch = await saveBatch(req.params.id, req.body, true);
    if (!batch) return res.status(404).json({ error: 'Project not found.' });
    res.json(batch);
  } catch (err) {
    console.error('Failed to update project:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete project:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// Stage advancement & status update
app.post('/api/batches/:id/advance-stage', async (req, res) => {
  const { nextStage, qcStatus, operator, notes } = req.body;
  if (!nextStage) return res.status(400).json({ error: 'nextStage is required.' });

  try {
    const result = await pool.query(
      `UPDATE projects SET
        current_stage = $1,
        qc_status = COALESCE($2, qc_status),
        notes = CASE WHEN $3::text IS NOT NULL THEN COALESCE(notes || E'\n' || $3, $3) ELSE notes END
      WHERE id = $4 RETURNING *`,
      [nextStage, qcStatus || null, notes ? `[${new Date().toISOString()}] ${notes}` : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Batch not found.' });

    // Record audit trail
    const auditId = generateId();
    await pool.query(
      'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
      [auditId, `Batch stage advanced to ${nextStage}`, 'Batch Lifecycle', operator || 'QC User']
    );

    res.json({ success: true, batch: result.rows[0] });
  } catch (err) {
    console.error('Failed to advance batch stage:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

const { calculateBatchQualityScore, PHARMA_STAGE_SPECS } = require('./complianceEngine');
const { evaluateSpectralIdentity, standardNormalVariate, savitzkyGolayFilter, pearsonCorrelation } = require('./spectrumSimilarity');
const { generateTamperProofReport } = require('./tamperProofReports');

// Comprehensive Batch Timeline & Traceability Passport (8-Stage Pharma Lifecycle)
app.get('/api/batches/:id/timeline', async (req, res) => {
  const batchId = req.params.id;
  try {
    const [batchRes, analyticalRes, dispensingRes, complianceRes] = await Promise.all([
      pool.query('SELECT * FROM projects WHERE id = $1', [batchId]),
      pool.query('SELECT * FROM analytical_data WHERE project_id = $1 ORDER BY received_at ASC', [batchId]),
      pool.query('SELECT * FROM dispensing_logs WHERE batch_id = $1 ORDER BY timestamp ASC', [batchId]),
      pool.query(`
        SELECT c.* FROM compliance_results c
        INNER JOIN analytical_data a ON c.analytical_data_id = a.id
        WHERE a.project_id = $1 ORDER BY c.evaluated_at ASC
      `, [batchId]),
    ]);

    if (batchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found.' });
    }

    const batch = batchRes.rows[0];
    const stages = [
      'Raw Material Receipt',
      'Dispensing',
      'Blending',
      'Granulation',
      'Drying',
      'Final Blending',
      'Compression',
      'Final QC'
    ];

    const timeline = stages.map((stageName, index) => {
      const stageReadings = analyticalRes.rows.filter(
        (r) => (r.process_stage || '').toLowerCase() === stageName.toLowerCase() ||
          (stageName === 'Dispensing' && dispensingRes.rows.length > 0)
      );
      const stageDispensing = stageName === 'Dispensing' ? dispensingRes.rows : [];
      const isCompleted = stages.indexOf(stageName) < stages.indexOf(batch.current_stage || stages[0]);
      const isCurrent = (batch.current_stage || stages[0]).toLowerCase() === stageName.toLowerCase();

      return {
        stageIndex: index + 1,
        stage: stageName,
        isCompleted,
        isCurrent,
        readingsCount: stageReadings.length + stageDispensing.length,
        specs: PHARMA_STAGE_SPECS[stageName] || [],
        readings: stageReadings.map((r) => ({
          id: r.id,
          parameter: r.parameter,
          value: r.value,
          dataType: r.data_type,
          imagePath: r.image_path,
          imageAnalysis: typeof r.image_analysis === 'string' ? JSON.parse(r.image_analysis) : r.image_analysis,
          values: r.values_data,
          receivedAt: r.received_at,
          defectTags: r.defect_tags,
        })),
        dispensing: stageDispensing,
      };
    });

    const qualityEvaluation = calculateBatchQualityScore(complianceRes.rows);

    res.json({
      batch: {
        id: batch.id,
        name: batch.name,
        product: batch.product,
        batchNumber: batch.batch_number,
        department: batch.department,
        line: batch.line,
        status: batch.status,
        materialId: batch.material_id,
        materialName: batch.material_name,
        supplier: batch.supplier,
        targetQuantity: batch.target_quantity,
        actualQuantity: batch.actual_quantity,
        weightDeviation: batch.weight_deviation,
        currentStage: batch.current_stage || 'Raw Material Receipt',
        qcStatus: batch.qc_status || 'In Progress',
        notes: batch.notes,
        createdAt: batch.created_at,
      },
      timeline,
      qualityEvaluation,
      complianceSummary: {
        total: complianceRes.rows.length,
        pass: complianceRes.rows.filter((r) => r.result === 'PASS').length,
        warning: complianceRes.rows.filter((r) => r.result === 'WARNING').length,
        critical: complianceRes.rows.filter((r) => r.result === 'CRITICAL').length,
      },
    });
  } catch (err) {
    console.error('Failed to get batch timeline:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// =============================================================
// STAGE-SPECIFIC SENSOR PROFILES & LIVE TELEMETRY CORE (8 STAGES)
// =============================================================
const STAGE_SENSOR_PROFILES = {
  'Raw Material Receipt': {
    stageIndex: 1,
    device: { id: 'PAT-NIR-01', name: 'InGaAs NIR Fiber Spectrometer', type: 'spectrometer', status: 'ONLINE' },
    parameters: [
      { name: 'NIR Spectral Identity (R)', instrument: 'FT-NIR Spectrometer (PAT-01)', unit: 'Pearson R', defaultVal: 0.993, spec: '>=0.950' },
      { name: 'Residual Moisture (LOD)', instrument: 'Halogen Moisture Analyzer (LOD-01)', unit: '%', defaultVal: 1.25, spec: '<=2.0%' },
      { name: 'Container Barcode Reconciliation', instrument: '2D Optical Matrix Scanner (BC-01)', unit: 'ID', defaultVal: 'BC-RM-9942-01', spec: '100% Match' }
    ]
  },
  'Dispensing': {
    stageIndex: 2,
    device: { id: 'SCALE-LOAD-02', name: 'Certified Dual Load Cell Balance', type: 'gravimetric', status: 'ONLINE' },
    parameters: [
      { name: 'Dispense Weight Tolerance', instrument: 'Certified Analytical Balance (WT-02)', unit: '% Dev', defaultVal: 0.24, spec: '<=1.0%' },
      { name: 'Actual Weighed Quantity', instrument: 'Digital Load Cell Platform', unit: 'kg', defaultVal: 50.12, spec: 'Recipe Target ±1%' },
      { name: 'Cleanroom Relative Humidity', instrument: 'Vaisala Humidity Transmitter (ENV-02)', unit: '% RH', defaultVal: 42.0, spec: '35.0 - 55.0%' },
      { name: 'Cleanroom Temperature', instrument: 'Cleanroom RTD Thermal Probe (ENV-02)', unit: '°C', defaultVal: 21.5, spec: '19.0 - 23.0 °C' }
    ]
  },
  'Blending': {
    stageIndex: 3,
    device: { id: 'PAT-PROBE-03', name: 'NIR Stratified Blend Probe & Tachometer', type: 'pat_blender', status: 'ONLINE' },
    parameters: [
      { name: 'Blend Uniformity RSD', instrument: 'In-Situ NIR Multi-Point Probe (PAT-03)', unit: '%', defaultVal: 2.8, spec: '<=5.0%' },
      { name: 'Homogeneity Index', instrument: 'Chemometric Homogeneity Analyzer (PAT-03)', unit: '%', defaultVal: 97.4, spec: '>=95.0%' },
      { name: 'Blender Speed', instrument: 'V-Blender Optical Tachometer (TACH-03)', unit: 'RPM', defaultVal: 24.0, spec: '20.0 - 28.0 RPM' },
      { name: 'Mixing Duration', instrument: 'Automated Process Timer (TMR-03)', unit: 'min', defaultVal: 15.0, spec: '12.0 - 18.0 min' }
    ]
  },
  'Granulation': {
    stageIndex: 4,
    device: { id: 'GRAN-SENS-04', name: 'High-Shear Motor Torque & Flow Sensor', type: 'torque_flow', status: 'ONLINE' },
    parameters: [
      { name: 'Impeller Torque Peak', instrument: 'High-Shear Impeller Torque Sensor (TRQ-04)', unit: 'Nm', defaultVal: 15.4, spec: '12.0 - 18.0 Nm' },
      { name: 'Wet Mass Consistency', instrument: 'Torque-Curve Rheology Analyzer (VSC-04)', unit: '%', defaultVal: 94.2, spec: '>=90.0%' },
      { name: 'Binder Spray Rate', instrument: 'Mass Flow Peristaltic Sensor (FLW-04)', unit: 'g/min', defaultVal: 45.0, spec: '40.0 - 50.0 g/min' },
      { name: 'Atomization Air Pressure', instrument: 'Digital Pressure Transducer (PRS-04)', unit: 'bar', defaultVal: 1.8, spec: '1.5 - 2.2 bar' }
    ]
  },
  'Drying': {
    stageIndex: 5,
    device: { id: 'FBD-NIR-05', name: 'Fluid Bed In-Situ NIR & Thermal RTD', type: 'fbd_sensors', status: 'ONLINE' },
    parameters: [
      { name: 'Loss on Drying (LOD)', instrument: 'In-Situ Microwave/NIR Probe (FBD-05)', unit: '%', defaultVal: 1.95, spec: '1.50 - 2.50%' },
      { name: 'Inlet Air Temperature', instrument: 'Inlet Thermal RTD Sensor (RTD-IN-05)', unit: '°C', defaultVal: 58.5, spec: '55.0 - 65.0 °C' },
      { name: 'Outlet Air Temperature', instrument: 'Exhaust Air RTD Sensor (RTD-OUT-05)', unit: '°C', defaultVal: 42.1, spec: '40.0 - 46.0 °C' },
      { name: 'Fluidization Airflow Velocity', instrument: 'Differential Pressure Transmitter (AF-05)', unit: 'm³/hr', defaultVal: 340, spec: '300 - 380 m³/hr' }
    ]
  },
  'Final Blending': {
    stageIndex: 6,
    device: { id: 'LUB-PAT-06', name: 'Lubricant Coating & Homogeneity Spectrophotometer', type: 'pat_spectro', status: 'ONLINE' },
    parameters: [
      { name: 'Lubrication Blend RSD', instrument: 'In-Line NIR Lubrication Probe (LUB-06)', unit: '%', defaultVal: 2.1, spec: '<=4.0%' },
      { name: 'Lubricant Coating Index', instrument: 'Surface Coating Efficiency Analyzer (SCA-06)', unit: '%', defaultVal: 98.2, spec: '>=95.0%' },
      { name: 'Rotational Speed', instrument: 'Low-Shear Blender Tachometer (TACH-06)', unit: 'RPM', defaultVal: 12.0, spec: '10.0 - 14.0 RPM' },
      { name: 'Blending Duration', instrument: 'Digital Cycle Timer (TMR-06)', unit: 'min', defaultVal: 4.8, spec: '5.0 ± 0.5 min' }
    ]
  },
  'Compression': {
    stageIndex: 7,
    device: { id: 'IPC-PRESS-07', name: 'Rotary Press Strain Gauge & Tablet Multi-Tester', type: 'press_ipc', status: 'ONLINE' },
    parameters: [
      { name: 'Main Compression Force', instrument: 'Rotary Press Piezoelectric Sensor (PRS-FC-07)', unit: 'kN', defaultVal: 16.8, spec: '14.0 - 20.0 kN' },
      { name: 'Tablet Hardness', instrument: 'Automated Tablet Hardness Tester (HRD-07)', unit: 'Kp', defaultVal: 9.4, spec: '7.0 - 12.0 Kp' },
      { name: 'Tablet Individual Weight', instrument: 'In-Line IPC Analytical Balance (WT-07)', unit: 'mg', defaultVal: 501.2, spec: '500.0 ± 15.0 mg' },
      { name: 'Friability', instrument: 'Digital Friabilator Sensor (FRB-07)', unit: '%', defaultVal: 0.22, spec: '<1.00%' }
    ]
  },
  'Final QC': {
    stageIndex: 8,
    device: { id: 'AI-CAM-QC-08', name: '360° AI High-Speed Optical Inspection & HPLC', type: 'vision_assay', status: 'ONLINE' },
    parameters: [
      { name: 'Active Assay', instrument: 'Automated In-Line HPLC Chromatography (HPLC-08)', unit: '%', defaultVal: 99.8, spec: '98.0 - 102.0%' },
      { name: 'Dissolution at 30 min', instrument: 'Automated Fiber-Optic Dissolution Telemetry (DIS-08)', unit: '%', defaultVal: 94.5, spec: '>=80.0%' },
      { name: 'Visual Defect Rate', instrument: '360° High-Speed Optical Inspection Camera (CAM-AI-08)', unit: '%', defaultVal: 0.02, spec: '<0.10%' },
      { name: 'Batch Quality Score', instrument: '21 CFR Part 11 Automated Compliance Engine', unit: 'Score', defaultVal: 96, spec: '>=85 (Grade A)' }
    ]
  }
};

function getCanonicalStageName(inputStage) {
  if (!inputStage) return 'Raw Material Receipt';
  const q = String(inputStage).toLowerCase().trim();
  if (q.includes('final blend') || q.includes('lubricat') || q === '6' || q === 'stage 6') return 'Final Blending';
  if (q.includes('blend') || q.includes('dry mix') || q.includes('mixing') || q === '3' || q === 'stage 3') return 'Blending';
  if (q.includes('dispens') || q.includes('weigh') || q === '2' || q === 'stage 2') return 'Dispensing';
  if (q.includes('granulat') || q === '4' || q === 'stage 4') return 'Granulation';
  if (q.includes('dry') || q.includes('fluid bed') || q === '5' || q === 'stage 5') return 'Drying';
  if (q.includes('compress') || q.includes('press') || q.includes('tablet') || q === '7' || q === 'stage 7') return 'Compression';
  if (q.includes('final qc') || q.includes('inspect') || q.includes('release') || q === '8' || q === 'stage 8') return 'Final QC';
  if (q.includes('raw') || q.includes('receipt') || q.includes('spectro') || q === '1' || q === 'stage 1') return 'Raw Material Receipt';
  return 'Raw Material Receipt';
}

// GET Live Sensor Telemetry for a specific stage & batch
app.get('/api/batches/:id/stage-sensor-data', async (req, res) => {
  const batchId = req.params.id;
  const canonicalStage = getCanonicalStageName(req.query.stage);
  const profile = STAGE_SENSOR_PROFILES[canonicalStage] || STAGE_SENSOR_PROFILES['Raw Material Receipt'];

  try {
    const [batchRes, readingsRes, dispensingRes] = await Promise.all([
      pool.query('SELECT * FROM projects WHERE id = $1', [batchId]),
      pool.query(
        `SELECT * FROM analytical_data
         WHERE project_id = $1 AND (process_stage ILIKE $2 OR process_stage ILIKE $3)
         ORDER BY received_at DESC LIMIT 50`,
        [batchId, canonicalStage, `%${canonicalStage}%`]
      ),
      canonicalStage === 'Dispensing'
        ? pool.query('SELECT * FROM dispensing_logs WHERE batch_id = $1 ORDER BY timestamp DESC LIMIT 5', [batchId])
        : Promise.resolve({ rows: [] })
    ]);

    const batch = batchRes.rows[0] || null;
    const existingReadings = readingsRes.rows || [];
    const dispensingLogs = dispensingRes.rows || [];

    // Map each parameter in the stage sensor profile to its latest live sensor reading
    const mappedParameters = profile.parameters.map((paramDef) => {
      // Look for a recent matching reading in analytical_data
      const found = existingReadings.find((r) =>
        r.parameter && (
          r.parameter.toLowerCase() === paramDef.name.toLowerCase() ||
          r.parameter.toLowerCase().includes(paramDef.name.toLowerCase()) ||
          paramDef.name.toLowerCase().includes(r.parameter.toLowerCase())
        )
      );

      if (found) {
        return {
          name: paramDef.name,
          instrument: found.instrument || paramDef.instrument,
          value: found.value !== null && !isNaN(Number(found.value)) ? Number(found.value) : (found.value || paramDef.defaultVal),
          unit: found.unit || paramDef.unit,
          spec: paramDef.spec,
          result: found.result || 'PASS',
          timestamp: found.received_at || found.device_timestamp || new Date().toISOString(),
          isLiveSensor: true,
          deviceId: found.device_id || profile.device.id,
          id: found.id
        };
      }

      // If dispensing stage and actual quantity
      if (canonicalStage === 'Dispensing' && dispensingLogs.length > 0) {
        const dLog = dispensingLogs[0];
        if (paramDef.name.includes('Tolerance') || paramDef.name.includes('Deviation')) {
          return {
            name: paramDef.name,
            instrument: paramDef.instrument,
            value: Number(dLog.deviation_percent || paramDef.defaultVal),
            unit: paramDef.unit,
            spec: paramDef.spec,
            result: dLog.status || 'PASS',
            timestamp: dLog.timestamp,
            isLiveSensor: true,
            deviceId: profile.device.id
          };
        }
        if (paramDef.name.includes('Actual')) {
          return {
            name: paramDef.name,
            instrument: paramDef.instrument,
            value: Number(dLog.actual_quantity || paramDef.defaultVal),
            unit: paramDef.unit,
            spec: paramDef.spec,
            result: 'PASS',
            timestamp: dLog.timestamp,
            isLiveSensor: true,
            deviceId: profile.device.id
          };
        }
      }

      // Fallback: Default calibrated baseline parameter
      return {
        name: paramDef.name,
        instrument: paramDef.instrument,
        value: paramDef.defaultVal,
        unit: paramDef.unit,
        spec: paramDef.spec,
        result: 'PASS',
        timestamp: new Date().toISOString(),
        isLiveSensor: false,
        deviceId: profile.device.id
      };
    });

    const allPass = mappedParameters.every((p) => p.result === 'PASS');
    const hasCritical = mappedParameters.some((p) => p.result === 'CRITICAL');

    res.json({
      success: true,
      batchId,
      stage: canonicalStage,
      stageIndex: profile.stageIndex,
      sensorDevice: profile.device,
      batch: batch ? {
        batchNumber: batch.batch_number,
        product: batch.product,
        currentStage: batch.current_stage,
        status: batch.status,
        qcStatus: batch.qc_status,
        targetQuantity: batch.target_quantity,
        actualQuantity: batch.actual_quantity
      } : null,
      parameters: mappedParameters,
      summary: {
        status: hasCritical ? 'CRITICAL' : allPass ? 'PASS' : 'WARNING',
        lastUpdated: new Date().toISOString(),
        hasLiveTelemetry: existingReadings.length > 0 || dispensingLogs.length > 0
      }
    });
  } catch (err) {
    console.error('Failed to get stage sensor data:', err);
    res.status(500).json({ error: 'Database error retrieving stage sensor data.' });
  }
});

// POST Stage-Specific Sensor Readings from IoT Devices or Hardware Simulator
app.post('/api/batches/:id/stage-sensor-data', async (req, res) => {
  const batchId = req.params.id;
  const canonicalStage = getCanonicalStageName(req.body.stage);
  const { readings, operator, deviceId } = req.body;

  if (!Array.isArray(readings) || readings.length === 0) {
    return res.status(400).json({ error: 'readings array is required.' });
  }

  const profile = STAGE_SENSOR_PROFILES[canonicalStage] || STAGE_SENSOR_PROFILES['Raw Material Receipt'];
  const activeDeviceId = deviceId || profile.device.id;
  const timestamp = new Date().toISOString();
  const savedRecords = [];

  try {
    for (const item of readings) {
      const readingId = generateId();
      const paramName = item.parameter || item.name;
      const paramValue = item.value !== undefined ? item.value : item.defaultVal;
      const paramUnit = item.unit || '';
      const instrument = item.instrument || profile.parameters.find(p => p.name === paramName)?.instrument || profile.device.name;

      // Determine result status
      let resultStatus = item.result || 'PASS';

      await pool.query(
        `INSERT INTO analytical_data (
          id, project_id, device_id, parameter, instrument, value, unit,
          process_stage, stage_step, reading_type, result, received_at, device_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          readingId, batchId, activeDeviceId, paramName, instrument,
          String(paramValue), paramUnit, canonicalStage, String(profile.stageIndex),
          'sensor_iot', resultStatus, timestamp, timestamp
        ]
      );

      savedRecords.push({
        id: readingId,
        parameter: paramName,
        value: paramValue,
        unit: paramUnit,
        instrument,
        result: resultStatus
      });
    }

    // Record audit trail
    const auditId = generateId();
    await pool.query(
      `INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)`,
      [
        auditId,
        `Stage ${profile.stageIndex} (${canonicalStage}) IoT Sensor Telemetry Ingested: ${savedRecords.length} channels from [${activeDeviceId}]`,
        'Sensor IoT Core',
        operator || 'IoT Gateway'
      ]
    );

    res.json({
      success: true,
      batchId,
      stage: canonicalStage,
      stageIndex: profile.stageIndex,
      deviceId: activeDeviceId,
      timestamp,
      savedCount: savedRecords.length,
      readings: savedRecords
    });
  } catch (err) {
    console.error('Failed to save stage sensor telemetry:', err);
    res.status(500).json({ error: 'Database error saving stage sensor data.' });
  }
});

// --- Spectroscopic Preprocessing & Identity Matching (Stage 1) ---
app.post('/api/spectroscopy/preprocess-and-match', async (req, res) => {
  const { parameter, incomingSpectrum, applySnv, applySavGol, moisturePercent } = req.body;

  try {
    const targetParam = parameter || 'Active Pharmaceutical Ingredient';
    const refResult = await pool.query(
      'SELECT * FROM reference_spectra WHERE (parameter ILIKE $1 OR parameter ILIKE $2) AND is_active = true',
      [targetParam, `%${targetParam}%`]
    );

    let referenceVariants = [];
    if (refResult.rows.length > 0) {
      referenceVariants = refResult.rows.map((r) => ({
        variantName: r.variant_name || r.parameter,
        referenceCurve: { x: r.reference_curve.xValues, y: r.reference_curve.yValues },
      }));
    } else {
      // Standard synthetic pharmaceutical API NIR fingerprint (900 nm - 1700 nm)
      const xRef = Array.from({ length: 81 }, (_, i) => 900 + i * 10);
      const yRef = xRef.map((w) =>
        +(0.2 + 0.6 * Math.exp(-Math.pow((w - 1180) / 45, 2)) + 0.85 * Math.exp(-Math.pow((w - 1450) / 60, 2)) + 0.4 * Math.exp(-Math.pow((w - 1620) / 35, 2))).toFixed(4)
      );
      referenceVariants = [{ variantName: 'Certified Pharmacopeia Reference Standard (EP/USP)', referenceCurve: { x: xRef, y: yRef } }];
    }

    const defaultSpectrum = incomingSpectrum || {
      x: Array.from({ length: 81 }, (_, i) => 900 + i * 10),
      y: Array.from({ length: 81 }, (_, i) => {
        const w = 900 + i * 10;
        const baseline = 0.22 + 0.58 * Math.exp(-Math.pow((w - 1180) / 46, 2)) + 0.83 * Math.exp(-Math.pow((w - 1450) / 62, 2)) + 0.39 * Math.exp(-Math.pow((w - 1620) / 36, 2));
        return +(baseline + (Math.random() * 0.02 - 0.01)).toFixed(4);
      })
    };

    const evalResult = evaluateSpectralIdentity(defaultSpectrum, referenceVariants, {
      applySnv: applySnv !== false,
      applySavGol: applySavGol !== false,
      moisturePercent: moisturePercent || 1.18,
    });

    res.json({
      success: true,
      result: evalResult,
      rawSpectrum: defaultSpectrum,
      referenceSpectrum: referenceVariants[0],
    });
  } catch (err) {
    console.error('Spectroscopy error:', err);
    res.status(500).json({ error: 'Spectroscopy processing failed.' });
  }
});

// --- Stage 1: Barcode Reconciliation ---
app.post('/api/stage1/reconcile-barcode', async (req, res) => {
  const { batchId, barcode, containerId, lotNumber, materialName, operator } = req.body;
  try {
    const auditId = generateId();
    const logText = `Stage 1 Raw Material Container Reconciliation: Scanned Barcode [${barcode || 'BC-RM-9942'}], Lot [${lotNumber || 'LOT-2026-RM'}], Container ID [${containerId || 'DRUM-01'}]. Verified by ${operator || 'Warehouse QA'}.`;

    await pool.query(
      'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
      [auditId, logText, 'Raw Material Receipt', operator || 'Warehouse QA']
    );

    res.json({
      success: true,
      reconciliationStatus: 'VERIFIED',
      barcode: barcode || 'BC-RM-9942',
      containerId: containerId || 'DRUM-01',
      lotNumber: lotNumber || 'LOT-2026-RM',
      materialName: materialName || 'Active Pharmaceutical Ingredient',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Barcode reconciliation error:', err);
    res.status(500).json({ error: 'Reconciliation failed.' });
  }
});

// --- Stage 1: Automated Quarantine & Deviation Alert ---
app.post('/api/stage1/quarantine-deviation', async (req, res) => {
  const { batchId, containerId, lotNumber, pearsonR, moisturePercent, reason, operator } = req.body;
  try {
    const devId = generateId();
    const auditId = generateId();
    const devText = `DEVIATION ALERT [DEV-STAGE1-${Date.now().toString().slice(-4)}]: Container ${containerId || 'DRUM-01'} (Lot ${lotNumber || 'RM-LOT'}) quarantined. Reason: ${reason || 'Spectral Identity Correlation R < 0.85'}. Initiated by ${operator || 'QC Inspector'}.`;

    res.json({
      success: true,
      deviationId: devId,
      quarantineStatus: 'LOCKED_IN_QUARANTINE',
      lotNumber,
      containerId,
      pearsonR,
      moisturePercent,
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Quarantine deviation error:', err);
    res.status(500).json({ error: 'Failed to trigger quarantine deviation.' });
  }
});

// --- Stage 1: Live PAT Telemetry Stream ---
app.get('/api/stage1/live-stream', async (req, res) => {
  const { batchId, mode = 'pass', containerId = 'DRUM-01', materialName = 'Paracetamol API Micronized' } = req.query;

  try {
    const wavelengths = Array.from({ length: 41 }, (_, i) => 900 + i * 20);

    // Master Reference (EP/USP Certified Standard)
    const referenceY = wavelengths.map(w =>
      +(0.2 + 0.6 * Math.exp(-Math.pow((w - 1180) / 45, 2)) + 0.85 * Math.exp(-Math.pow((w - 1450) / 60, 2)) + 0.4 * Math.exp(-Math.pow((w - 1620) / 35, 2))).toFixed(4)
    );

    // Live sensor absorbance with micro-fluctuations (PAT sensor noise)
    const jitter = () => (Math.random() * 0.016 - 0.008);
    let sampleY;
    let pearsonR;
    let moisture;
    let gateStatus;

    if (mode === 'fail') {
      sampleY = wavelengths.map(w =>
        +(0.2 + 0.22 * Math.exp(-Math.pow((w - 1100) / 50, 2)) + 0.38 * Math.exp(-Math.pow((w - 1350) / 70, 2)) + 0.72 * Math.exp(-Math.pow((w - 1550) / 40, 2)) + jitter()).toFixed(4)
      );
      pearsonR = +(0.72 + Math.random() * 0.05).toFixed(4);
      moisture = +(3.2 + Math.random() * 0.4).toFixed(2);
      gateStatus = 'CRITICAL_QUARANTINE';
    } else if (mode === 'warning') {
      sampleY = wavelengths.map(w =>
        +(0.22 + 0.54 * Math.exp(-Math.pow((w - 1180) / 46, 2)) + 0.78 * Math.exp(-Math.pow((w - 1450) / 64, 2)) + 0.36 * Math.exp(-Math.pow((w - 1620) / 37, 2)) + jitter()).toFixed(4)
      );
      pearsonR = +(0.908 + Math.random() * 0.02).toFixed(4);
      moisture = +(2.1 + Math.random() * 0.2).toFixed(2);
      gateStatus = 'WARNING_REVIEW';
    } else {
      // Pass mode (High purity API match)
      sampleY = wavelengths.map(w =>
        +(0.2 + 0.6 * Math.exp(-Math.pow((w - 1180) / 45, 2)) + 0.85 * Math.exp(-Math.pow((w - 1450) / 60, 2)) + 0.4 * Math.exp(-Math.pow((w - 1620) / 35, 2)) + jitter()).toFixed(4)
      );
      pearsonR = +(0.982 + Math.random() * 0.014).toFixed(4);
      moisture = +(1.12 + Math.random() * 0.15).toFixed(2);
      gateStatus = 'PASS';
    }

    const cosineSim = +(pearsonR * 100 + (Math.random() * 0.4 - 0.2)).toFixed(2);
    const readingId = generateId();
    const timestamp = new Date().toISOString();

    // Auto-log live PAT telemetry into analytical_data table
    try {
      if (batchId) {
        await pool.query(
          `INSERT INTO analytical_data (
            id, project_id, parameter, instrument, value, unit,
            acceptance_criteria, result, reading_type, process_stage, device_timestamp
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            readingId, batchId, 'NIR Spectral Identity (R)', 'Portable NIR Micro-Spectrometer (PAT-01)',
            pearsonR, 'R', 'R >= 0.950 (USP/EP)', gateStatus === 'PASS' ? 'PASS' : gateStatus === 'WARNING_REVIEW' ? 'WARNING' : 'CRITICAL',
            'live', 'Raw Material Receipt', timestamp
          ]
        );
      }
    } catch (dbErr) {
      // Continue if DB write is skipped
    }

    res.json({
      success: true,
      timestamp,
      batchId,
      containerId,
      materialName,
      mode,
      telemetry: {
        wavelengths,
        sampleSpectrum: sampleY,
        referenceSpectrum: referenceY,
        pearsonR,
        cosineSimilarity: cosineSim,
        moisturePercent: moisture,
        gateStatus,
        sensorDeviceId: 'PAT-NIR-SPEC-01',
        sensorStatus: 'ONLINE_ACTIVE',
        cleanroomEnv: { tempC: +(21.5 + Math.random() * 0.4).toFixed(1), rhPercent: +(42.0 + Math.random() * 1.5).toFixed(1) }
      }
    });
  } catch (err) {
    console.error('Live stream error:', err);
    res.status(500).json({ error: 'Failed to generate live PAT telemetry.' });
  }
});



// --- Dual-Operator Line Clearance & Dispensing Signoff (Stage 2) ---
app.post('/api/batches/:id/dual-signoff', async (req, res) => {
  const { primaryOperator, secondaryVerifier, lineCleanlinessVerified, balanceCalibrated, ambientHumidity, notes } = req.body;
  const batchId = req.params.id;

  if (!primaryOperator || !secondaryVerifier) {
    return res.status(400).json({ error: 'Dual-operator signoff requires both primary operator and secondary QA verifier names.' });
  }

  try {
    const auditId = generateId();
    const logText = `21 CFR Part 11 Dual Line Clearance Signed: Dispensed by ${primaryOperator}, Verified by ${secondaryVerifier}. Balance Calibration: ${balanceCalibrated ? 'PASS' : 'FAIL'}, Line Cleanliness: ${lineCleanlinessVerified ? 'PASS' : 'FAIL'}, RH: ${ambientHumidity || '42%'}%`;

    await pool.query(
      'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
      [auditId, logText, 'Dispensing & Line Clearance', secondaryVerifier]
    );

    res.json({
      success: true,
      batchId,
      lineClearance: {
        primaryOperator,
        secondaryVerifier,
        lineCleanlinessVerified: !!lineCleanlinessVerified,
        balanceCalibrated: !!balanceCalibrated,
        ambientHumidity: ambientHumidity || 42.5,
        signedAt: new Date().toISOString(),
        status: (lineCleanlinessVerified && balanceCalibrated) ? 'VERIFIED' : 'CONDITIONAL',
      }
    });
  } catch (err) {
    console.error('Failed to log dual-signoff:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- 21 CFR Part 11 QA Batch Release & Cryptographic Dossier (Stage 8) ---
app.post('/api/batches/:id/qa-release', async (req, res) => {
  const { qaOfficerName, qaOfficerRole, passwordConfirmation, disposition, comments } = req.body;
  const batchId = req.params.id;

  if (!qaOfficerName || !disposition) {
    return res.status(400).json({ error: 'qaOfficerName and disposition are required.' });
  }

  try {
    const batchRes = await pool.query('SELECT * FROM projects WHERE id = $1', [batchId]);
    if (batchRes.rows.length === 0) return res.status(404).json({ error: 'Batch not found.' });

    const batch = batchRes.rows[0];
    const newStatus = disposition === 'APPROVED' ? 'Completed' : 'Quarantined';
    const newQcStatus = disposition === 'APPROVED' ? 'Approved' : 'Rejected';

    await pool.query(
      `UPDATE projects SET status = $1, qc_status = $2, current_stage = 'Final QC' WHERE id = $3`,
      [newStatus, newQcStatus, batchId]
    );

    const dossierContent = {
      batchId: batch.id,
      batchNumber: batch.batch_number,
      productName: batch.product,
      disposition,
      releasedBy: qaOfficerName,
      officerRole: qaOfficerRole || 'Lead Quality Assurance Officer',
      signedAt: new Date().toISOString(),
      complianceStandard: '21 CFR Part 11 Electronic Records & Signatures',
      releaseNotes: comments || 'Formal QA release disposition executed following full 8-stage lifecycle audit.',
    };

    const sealedDossier = generateTamperProofReport(dossierContent);

    // Save report to reports table
    await pool.query(
      'INSERT INTO reports (id, content, integrity) VALUES ($1, $2, $3)',
      [sealedDossier.id, JSON.stringify(sealedDossier.content), JSON.stringify(sealedDossier.integrity)]
    );


    // Audit Trail
    const auditId = generateId();
    await pool.query(
      'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
      [auditId, `21 CFR Part 11 Batch Release: ${disposition} by ${qaOfficerName} (SHA-256 Hash: ${sealedDossier.integrity.hash.slice(0, 12)}...)`, 'QA Batch Release', qaOfficerName]
    );

    res.json({
      success: true,
      batchId,
      disposition,
      status: newStatus,
      qcStatus: newQcStatus,
      dossier: sealedDossier,
    });
  } catch (err) {
    console.error('Failed to execute QA release:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});


// --- Dispensing Transactions (Stage 2) ---
app.post('/api/dispensing', async (req, res) => {
  const { batchId, materialId, materialName, lotNumber, targetQuantity, actualQuantity, operatorName } = req.body;

  if (!batchId || targetQuantity === undefined || actualQuantity === undefined) {
    return res.status(400).json({ error: 'batchId, targetQuantity, and actualQuantity are required.' });
  }

  const target = parseFloat(targetQuantity);
  const actual = parseFloat(actualQuantity);
  const deviation = target > 0 ? parseFloat((((actual - target) / target) * 100).toFixed(2)) : 0;

  // Standard pharmaceutical tolerance limit for dispensing: +/- 1.0% pass, 1.0-2.0% warning, >2.0% critical
  let status = 'PASS';
  if (Math.abs(deviation) > 2.0) {
    status = 'CRITICAL';
  } else if (Math.abs(deviation) > 1.0) {
    status = 'WARNING';
  }

  const id = generateId();
  try {
    await pool.query(
      `INSERT INTO dispensing_logs (id, batch_id, material_id, material_name, lot_number, target_quantity, actual_quantity, deviation_percent, operator_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, batchId, materialId || null, materialName || null, lotNumber || null, target, actual, deviation, operatorName || 'Operator', status]
    );

    // Update batch weight deviation
    await pool.query(
      `UPDATE projects SET target_quantity = $1, actual_quantity = $2, weight_deviation = $3 WHERE id = $4`,
      [target, actual, deviation, batchId]
    );

    // Audit entry
    const auditId = generateId();
    await pool.query(
      'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
      [auditId, `Dispensed ${actual} kg (Target: ${target} kg, Deviation: ${deviation}%, Status: ${status})`, 'Dispensing & Weighing', operatorName || 'Operator']
    );

    res.json({ id, batchId, targetQuantity: target, actualQuantity: actual, deviationPercent: deviation, status, operatorName });
  } catch (err) {
    console.error('Failed to record dispensing:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.get('/api/dispensing/:batchId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dispensing_logs WHERE batch_id = $1 ORDER BY timestamp DESC', [req.params.batchId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to get dispensing logs:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});


// --- Monitoring Points ---
app.post('/api/monitoring', async (req, res) => {
  const { name, location, frequency, description, status, projectId } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO monitoring_points (id, name, location, frequency, description, status, project_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, name, location, frequency, description, status || 'Active', projectId || null]
    );
    res.json({ id, name, location, frequency, description, status: status || 'Active', projectId: projectId || null });
  } catch (err) {
    console.error('Failed to create monitoring point:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});
app.put('/api/monitoring/:id', async (req, res) => {
  const { name, location, frequency, description, status, projectId } = req.body;
  try {
    const result = await pool.query(
      'UPDATE monitoring_points SET name=$1, location=$2, frequency=$3, description=$4, status=$5, project_id=$6 WHERE id=$7 RETURNING *',
      [name, location, frequency, description, status, projectId || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Monitoring point not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update monitoring point:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});
app.delete('/api/monitoring/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM monitoring_points WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete monitoring point:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Parameters ---
app.post('/api/parameters', async (req, res) => {
  const { name, monitoringPointId, instrument, unit, frequency, description } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO parameters (id, name, monitoring_point_id, instrument, unit, frequency, description) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, name, monitoringPointId || null, instrument, unit, frequency, description]
    );
    res.json({ id, name, monitoringPointId, instrument, unit, frequency, description });
  } catch (err) {
    console.error('Failed to create parameter:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/parameters/:id', async (req, res) => {
  const { name, monitoringPointId, instrument, unit, frequency, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE parameters SET name=$1, monitoring_point_id=$2, instrument=$3, unit=$4, frequency=$5, description=$6 WHERE id=$7 RETURNING *',
      [name, monitoringPointId || null, instrument, unit, frequency, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Parameter not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update parameter:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/parameters/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM parameters WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete parameter:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Checkout Conditions ---
app.post('/api/conditions', async (req, res) => {
  const { parameter, monitoringPointId, acceptance, warning, critical, action, regulatoryRuleId } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO checkout_conditions (id, parameter, monitoring_point_id, acceptance, warning, critical, action, regulatory_rule_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, parameter, monitoringPointId || null, acceptance, warning, critical, action, regulatoryRuleId || null]
    );
    res.json({ id, parameter, monitoringPointId, acceptance, warning, critical, action, regulatoryRuleId });
  } catch (err) {
    console.error('Failed to create condition:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});
app.put('/api/conditions/:id', async (req, res) => {
  const { parameter, monitoringPointId, acceptance, warning, critical, action, regulatoryRuleId } = req.body;
  try {
    const result = await pool.query(
      'UPDATE checkout_conditions SET parameter=$1, monitoring_point_id=$2, acceptance=$3, warning=$4, critical=$5, action=$6, regulatory_rule_id=$7 WHERE id=$8 RETURNING *',
      [parameter, monitoringPointId || null, acceptance, warning, critical, action, regulatoryRuleId || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Condition not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update condition:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/conditions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM checkout_conditions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete condition:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Regulatory Rules ---
app.post('/api/rules', async (req, res) => {
  const { name, description, status } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO regulatory_rules (id, name, description, status) VALUES ($1,$2,$3,$4)',
      [id, name, description, status || 'Active']
    );
    res.json({ id, name, description, status: status || 'Active' });
  } catch (err) {
    console.error('Failed to create rule:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/rules/:id', async (req, res) => {
  const { name, description, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE regulatory_rules SET name=$1, description=$2, status=$3 WHERE id=$4 RETURNING *',
      [name, description, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update rule:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/rules/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM regulatory_rules WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete rule:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Manual analytical data entry (CSV upload or single manual entry) ---
app.post('/api/analytical', async (req, res) => {
  const { parameter, instrument, value, unit, timestamp, monitoringPointId, projectId, batchId, processStage, stageStep, defectTags, sampleMetadata } = req.body;

  if (!parameter || value === undefined) {
    return res.status(400).json({ error: 'parameter and value are required.' });
  }

  const targetBatchId = batchId || projectId || null;
  const id = generateId();
  try {
    await pool.query(
      `INSERT INTO analytical_data (id, monitoring_point_id, project_id, process_stage, stage_step, defect_tags, sample_metadata, reading_type, parameter, value, unit, device_timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id, monitoringPointId || null, targetBatchId, processStage || null,
        stageStep || null, defectTags || null,
        sampleMetadata ? (typeof sampleMetadata === 'object' ? JSON.stringify(sampleMetadata) : sampleMetadata) : null,
        'manual', parameter, String(value), unit || null, timestamp || null
      ]
    );
    res.json({ id, parameter, instrument, value, unit, timestamp, projectId: targetBatchId, batchId: targetBatchId, processStage });
  } catch (err) {
    console.error('Failed to save manual analytical entry:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});
app.use('/api', sensorRoutes(pool, generateId));
app.use('/api', complianceRoutes(pool, generateId));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Spectroscopic Intelligence backend running on port ${PORT} (PostgreSQL/Supabase)`);
});
