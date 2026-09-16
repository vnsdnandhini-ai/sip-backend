const pool = require('./db');

async function runMigrations() {
  try {
    console.log('Checking database schema...');

    const safeAlter = async (query) => {
      try {
        await pool.query(query);
      } catch (e) {
        // ignore already exists or minor schema errors
      }
    };

    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS process_stage VARCHAR(255);`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS stage_step VARCHAR(255);`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS defect_tags VARCHAR(255);`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS sample_metadata TEXT;`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS instrument VARCHAR(255);`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS result VARCHAR(50);`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS data_type VARCHAR(50);`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);`);
    await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS image_analysis JSONB;`);

    // Add pharmaceutical fields to projects (batches)
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS material_id VARCHAR(255);`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS material_name VARCHAR(255);`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS supplier VARCHAR(255);`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_quantity NUMERIC;`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_quantity NUMERIC;`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS weight_deviation NUMERIC;`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_stage VARCHAR(255) DEFAULT 'Raw Material Receipt';`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS qc_status VARCHAR(255) DEFAULT 'In Progress';`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS workflow_id VARCHAR(255);`);
    await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_stages JSONB;`);

    // Create dispensing logs table for Stage 2
    await safeAlter(`
      CREATE TABLE IF NOT EXISTS dispensing_logs (
        id VARCHAR(255) PRIMARY KEY,
        batch_id VARCHAR(255),
        material_id VARCHAR(255),
        material_name VARCHAR(255),
        lot_number VARCHAR(255),
        target_quantity NUMERIC,
        actual_quantity NUMERIC,
        deviation_percent NUMERIC,
        operator_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'PASS',
        timestamp TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Create process_workflows table for Generic & Configurable process workflows
    await safeAlter(`
      CREATE TABLE IF NOT EXISTS process_workflows (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Solid Dosage',
        description TEXT,
        is_default BOOLEAN DEFAULT false,
        stages JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Seed default industry workflows if table is empty
    const existingWorkflows = await pool.query('SELECT count(*) FROM process_workflows');
    if (parseInt(existingWorkflows.rows[0].count, 10) === 0) {
      console.log('Seeding pre-configured industrial process workflows...');

      const defaultWorkflows = [
        {
          id: 'wf-tablet-8step',
          name: 'Standard 8-Step Tablet Manufacturing (USP)',
          category: 'Solid Dosage Tablets',
          description: 'Comprehensive 8-stage solid dosage tablet manufacturing with in-line NIR spectroscopy, torque curve monitoring, LOD moisture tracking, and 360° AI tablet vision inspection.',
          is_default: true,
          stages: [
            { id: 1, name: 'Raw Material Receipt', label: '1. Raw Material ID', sub: 'Spectroscopy & AI', icon: '🔬', device: 'InGaAs NIR Fiber Spectrometer (PAT-01)', parameters: ['NIR Spectral Identity (R)', 'Residual Moisture (LOD)', 'Container Barcode Reconciliation'] },
            { id: 2, name: 'Dispensing', label: '2. Dispensing', sub: 'Gravimetric Weighing', icon: '⚖️', device: 'Certified Dual Load Cell Balance (WT-02)', parameters: ['Dispense Weight Tolerance', 'Actual Weighed Quantity', 'Cleanroom Relative Humidity', 'Cleanroom Temperature'] },
            { id: 3, name: 'Blending', label: '3. Pre-Blending', sub: 'Dry Mixing & PAT', icon: '🔄', device: 'NIR Stratified Blend Probe (PAT-03)', parameters: ['Blend Uniformity RSD', 'Homogeneity Index', 'Blender Speed', 'Mixing Duration'] },
            { id: 4, name: 'Granulation', label: '4. Wet Granulation', sub: 'Torque & Binder', icon: '🧪', device: 'High-Shear Torque & Rheology Sensor (GRAN-04)', parameters: ['Impeller Torque Peak', 'Wet Mass Consistency', 'Binder Spray Rate', 'Atomization Air Pressure'] },
            { id: 5, name: 'Drying', label: '5. Fluid Bed Drying', sub: 'Moisture LOD & Temp', icon: '💨', device: 'Fluid Bed In-Situ NIR & Thermal RTD (FBD-05)', parameters: ['Loss on Drying (LOD)', 'Inlet Air Temperature', 'Outlet Air Temperature', 'Fluidization Airflow Velocity'] },
            { id: 6, name: 'Final Blending', label: '6. Final Blending', sub: 'Lubrication & RSD', icon: '🌀', device: 'Lubricant Coating Spectrophotometer (LUB-06)', parameters: ['Lubrication Blend RSD', 'Lubricant Coating Index', 'Rotational Speed', 'Blending Duration'] },
            { id: 7, name: 'Compression', label: '7. Tablet Press', sub: 'Force & Hardness', icon: '💊', device: 'Rotary Press Piezoelectric Sensor (PRS-07)', parameters: ['Main Compression Force', 'Tablet Hardness', 'Tablet Individual Weight', 'Friability'] },
            { id: 8, name: 'Final QC', label: '8. Final Inspection', sub: 'Vision & QA Release', icon: '🏆', device: '360° AI High-Speed Optical Camera & HPLC (QC-08)', parameters: ['Active Assay', 'Dissolution at 30 min', 'Visual Defect Rate', 'Batch Quality Score'] }
          ]
        },
        {
          id: 'wf-liquid-4step',
          name: '4-Step Liquid Oral Suspension (Syrup)',
          category: 'Liquid Dosage',
          description: '4-stage oral liquid syrup production covering raw material spectral assay, automated sugar vehicle dissolution, high-shear homogenization, and sterile in-line filling.',
          is_default: false,
          stages: [
            { id: 1, name: 'Raw Material Verification', label: '1. Material Assay', sub: 'NIR & Refractometer', icon: '🔬', device: 'Portable NIR & Digital Refractometer (LIQ-01)', parameters: ['Active API Assay %', 'Vehicle Specific Gravity', 'Raw Material Barcode Match'] },
            { id: 2, name: 'Sugar Dissolution', label: '2. Vehicle Prep', sub: 'Brix & Heated Agitation', icon: '🍯', device: 'Jacketed Vessel RTD & Digital Brix Meter (LIQ-02)', parameters: ['Brix Sugar Content (°Bx)', 'Vessel Temperature (°C)', 'Agitator Speed (RPM)', 'pH Level'] },
            { id: 3, name: 'Homogenization', label: '3. Homogenization', sub: 'Viscosity & Particle Size', icon: '🌀', device: 'In-Line Rotational Viscometer (LIQ-03)', parameters: ['Dynamic Viscosity (cP)', 'Homogenizer Pressure (bar)', 'Suspension Uniformity %', 'Batch Temperature (°C)'] },
            { id: 4, name: 'Filling & Release', label: '4. Sterile Filling & QC', sub: 'Volume & Optical Check', icon: '🧪', device: 'High-Speed Optical Level & Seal Inspector (LIQ-04)', parameters: ['Fill Volume Accuracy (mL)', 'Particulate Defect Rate %', 'Torque Capper Force (Nm)', 'Microbial Quality Gate'] }
          ]
        },
        {
          id: 'wf-capsule-5step',
          name: '5-Step Hard Gelatin Capsule Filling',
          category: 'Solid Dosage Capsules',
          description: '5-stage hard capsule manufacturing workflow with raw material spectroscopy, micro-dispensing, tumbler powder blending, automatic capsule tamping, and weight variation control.',
          is_default: false,
          stages: [
            { id: 1, name: 'Raw Material Testing', label: '1. Raw Material ID', sub: 'Spectroscopy', icon: '🔬', device: 'FT-NIR InGaAs Spectrometer (CAP-01)', parameters: ['API Spectral Identity (R)', 'Moisture LOD %', 'Container Barcode Status'] },
            { id: 2, name: 'Precision Dispensing', label: '2. Dispensing', sub: 'Micro-Weighing', icon: '⚖️', device: 'Analytical Micro-Balance (CAP-02)', parameters: ['Dispense Target Deviation %', 'Active Powder Weight (kg)', 'Cleanroom Temp (°C)', 'Cleanroom RH %'] },
            { id: 3, name: 'Powder Blending', label: '3. Blending', sub: 'Uniformity Index', icon: '🔄', device: 'V-Blender Optical Tachometer & PAT (CAP-03)', parameters: ['Blend Homogeneity %', 'Blend RSD %', 'Blender Speed (RPM)', 'Cycle Time (min)'] },
            { id: 4, name: 'Encapsulation & Tamping', label: '4. Capsule Tamping', sub: 'Dosing Pin Force', icon: '💊', device: 'Encapsulator Tamping Pin Load Cell (CAP-04)', parameters: ['Tamping Force (N)', 'Filling Speed (caps/hr)', 'Powder Bed Depth (mm)', 'Lock Length (mm)'] },
            { id: 5, name: 'Weight & Polish QC', label: '5. Final Inspection', sub: 'Checkweigher & Vision', icon: '🏆', device: 'Automatic Checkweigher & Vision System (CAP-05)', parameters: ['Individual Weight Deviation %', 'Defective Capsule Rate %', 'Disintegration Time (min)', 'QA Release Disposition'] }
          ]
        },
        {
          id: 'wf-ointment-3step',
          name: '3-Step Semisolid Topical Ointment',
          category: 'Semisolid Dosage',
          description: '3-stage topical cream/ointment formulation covering raw material phase testing, heated vacuum emulsification, and sterile de-aeration & tube packaging.',
          is_default: false,
          stages: [
            { id: 1, name: 'Phase Material ID', label: '1. Phase Testing', sub: 'Spectroscopy & Melting Point', icon: '🔬', device: 'NIR & Digital Melting Point Apparatus (ONT-01)', parameters: ['Oil Phase Purity %', 'Water Phase Conductivity (µS)', 'Active Drug Assay %'] },
            { id: 2, name: 'Emulsification', label: '2. Vacuum Emulsification', sub: 'Shear & Temperature', icon: '🧴', device: 'Vacuum Emulsifier Homogenizer Probe (ONT-02)', parameters: ['Emulsion Viscosity (cP)', 'Batch Core Temp (°C)', 'Vacuum Level (bar)', 'Homogenizer RPM'] },
            { id: 3, name: 'Tube Filling & QC', label: '3. Packaging & Release', sub: 'Weight & Crimp Integrity', icon: '🏆', device: 'Automated Tube Filler & Ultrasonic Sealer (ONT-03)', parameters: ['Net Fill Weight (g)', 'Tube Crimp Integrity %', 'Extrudability Force (N)', 'QA Release Score'] }
          ]
        }
      ];

      for (const wf of defaultWorkflows) {
        await pool.query(
          `INSERT INTO process_workflows (id, name, category, description, is_default, stages)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [wf.id, wf.name, wf.category, wf.description, wf.is_default, JSON.stringify(wf.stages)]
        );
      }
    }

    console.log('Schema check & workflow seeding complete.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

if (require.main === module) {
  runMigrations().then(() => {
    console.log('Migration finished');
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = runMigrations;
