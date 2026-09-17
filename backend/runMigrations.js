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

    // --- cGMP Compliance Tables ---
    // 1. Deviations & CAPA Management (FDA 21 CFR 211.192 / ICH Q10)
    await safeAlter(`
      CREATE TABLE IF NOT EXISTS cgmp_deviations (
        id VARCHAR(255) PRIMARY KEY,
        deviation_number VARCHAR(100) UNIQUE,
        batch_id VARCHAR(255),
        stage_name VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        classification VARCHAR(50) DEFAULT 'MAJOR',
        deviation_type VARCHAR(100) DEFAULT 'OOS',
        parameter_involved VARCHAR(255),
        observed_value VARCHAR(255),
        limit_specified VARCHAR(255),
        root_cause_category VARCHAR(100),
        root_cause_details TEXT,
        capa_action TEXT,
        preventive_action TEXT,
        assigned_qa VARCHAR(255),
        status VARCHAR(50) DEFAULT 'OPEN',
        logged_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT now(),
        closed_at TIMESTAMPTZ,
        qa_signature_hash VARCHAR(255)
      );
    `);

    // 2. Equipment Qualification & Calibration (FDA 21 CFR 211.68 / EU GMP Annex 15)
    await safeAlter(`
      CREATE TABLE IF NOT EXISTS equipment_qualification (
        id VARCHAR(255) PRIMARY KEY,
        equipment_tag VARCHAR(100) UNIQUE NOT NULL,
        equipment_name VARCHAR(255) NOT NULL,
        stage_assigned VARCHAR(255),
        cleanroom_location VARCHAR(255),
        qualification_status VARCHAR(50) DEFAULT 'QUALIFIED',
        iq_status VARCHAR(50) DEFAULT 'PASSED',
        oq_status VARCHAR(50) DEFAULT 'PASSED',
        pq_status VARCHAR(50) DEFAULT 'PASSED',
        last_calibration_date DATE,
        next_calibration_date DATE,
        calibration_standard VARCHAR(255),
        calibration_certificate_id VARCHAR(100),
        accuracy_tolerance VARCHAR(100),
        status_interlock BOOLEAN DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // 3. Cleanroom & Environmental HVAC Monitoring (ISO 14644-1 / EU GMP Grade A-D)
    await safeAlter(`
      CREATE TABLE IF NOT EXISTS environmental_monitoring (
        id VARCHAR(255) PRIMARY KEY,
        suite_id VARCHAR(100) NOT NULL,
        suite_name VARCHAR(255) NOT NULL,
        cleanroom_grade VARCHAR(50) NOT NULL,
        differential_pressure_pa NUMERIC NOT NULL,
        particle_count_05um NUMERIC NOT NULL,
        particle_count_50um NUMERIC NOT NULL,
        temperature_c NUMERIC NOT NULL,
        relative_humidity_pct NUMERIC NOT NULL,
        air_changes_per_hr NUMERIC,
        status VARCHAR(50) DEFAULT 'NORMAL',
        recorded_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // 4. Operator Training & Competency Matrix (FDA 21 CFR 211.25 / WHO GMP)
    await safeAlter(`
      CREATE TABLE IF NOT EXISTS personnel_training (
        id VARCHAR(255) PRIMARY KEY,
        employee_id VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL,
        gmp_certification_level VARCHAR(50) DEFAULT 'GMP-Level-2',
        sop_compliance_score NUMERIC DEFAULT 98.5,
        qualified_stages JSONB NOT NULL,
        qualification_status VARCHAR(50) DEFAULT 'CERTIFIED',
        last_training_date DATE,
        next_refresher_date DATE,
        supervisor_verification VARCHAR(255)
      );
    `);

    // 5. 21 CFR Part 11 Dual Electronic Signatures (FDA 21 CFR 11.50 / 11.200)
    await safeAlter(`
      CREATE TABLE IF NOT EXISTS electronic_signatures (
        id VARCHAR(255) PRIMARY KEY,
        record_id VARCHAR(255) NOT NULL,
        record_type VARCHAR(100) NOT NULL,
        signer_name VARCHAR(255) NOT NULL,
        signer_role VARCHAR(100) NOT NULL,
        signer_id VARCHAR(100),
        signature_intent VARCHAR(255) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT now(),
        sha256_hash VARCHAR(255) NOT NULL,
        verification_status VARCHAR(50) DEFAULT 'VALID'
      );
    `);

    // Seed cGMP records if empty
    const existingDeviations = await pool.query('SELECT count(*) FROM cgmp_deviations');
    if (parseInt(existingDeviations.rows[0].count, 10) === 0) {
      console.log('Seeding initial cGMP deviations & CAPAs...');
      await pool.query(`
        INSERT INTO cgmp_deviations 
        (id, deviation_number, batch_id, stage_name, title, classification, deviation_type, parameter_involved, observed_value, limit_specified, root_cause_category, root_cause_details, capa_action, preventive_action, assigned_qa, status, logged_by, created_at)
        VALUES 
        ('dev-001', 'DEV-2026-089', 'LOT-PCM-2026-01', 'Granulation', 'Transient Torque Surge in High-Shear Impeller', 'MINOR', 'OOT', 'Impeller Torque Peak', '19.4 N·m', '12.0 - 18.0 N·m', 'Machine', 'Viscous binder atomization spray nozzle pressure dropped temporarily by 0.3 bar.', 'Cleaned liquid binder delivery nozzle and verified spray pattern reproducibility.', 'Scheduled weekly nozzle ultrasonic cleaning in preventative maintenance SOP-EQ-014.', 'Dr. S. K. Narayanan (QA Head)', 'CLOSED', 'V. Rajesh (Senior Process Chemist)', now() - interval '2 days'),
        ('dev-002', 'DEV-2026-092', 'LOT-PCM-2026-01', 'Final Blending', 'Stratified Lubrication Blend RSD Borderline Warning', 'MAJOR', 'OOS', 'Lubrication Blend RSD', '4.4%', '<= 4.0%', 'Method', 'Extended tumble mixing duration caused mild electrostatic agglomeration at tumble top wall.', 'Extended mixing stopped. Stratified 10-point core blend re-sampled per USP <905> with acceptable uniformity.', 'Added optical PAT blend end-point detection in SOP-MFG-302 to prevent over-lubrication.', 'K. Meenakshi (Lead QA Auditor)', 'OPEN', 'M. Anitha (QA Officer)', now() - interval '4 hours')
        ON CONFLICT DO NOTHING;
      `);
    }

    const existingEquipment = await pool.query('SELECT count(*) FROM equipment_qualification');
    if (parseInt(existingEquipment.rows[0].count, 10) === 0) {
      console.log('Seeding cGMP equipment qualification records...');
      await pool.query(`
        INSERT INTO equipment_qualification 
        (id, equipment_tag, equipment_name, stage_assigned, cleanroom_location, qualification_status, iq_status, oq_status, pq_status, last_calibration_date, next_calibration_date, calibration_standard, calibration_certificate_id, accuracy_tolerance, status_interlock)
        VALUES 
        ('eq-01', 'PAT-NIR-01', 'InGaAs High-Res Fiber NIR Spectrometer', 'Raw Material Receipt', 'Sampling Room ISO 7 / Suite A', 'QUALIFIED', 'PASSED', 'PASSED', 'PASSED', '2026-08-01', '2027-02-01', 'USP <1119> / NIST Polystyrene & Wavelength Traceable Standard', 'CAL-CERT-2026-NIR01', '±0.002 AU Absorbance', true),
        ('eq-02', 'BAL-WT-02', 'Certified Dual-Range Analytical Balance', 'Dispensing', 'Dispensing Suite ISO 7 / Suite B', 'QUALIFIED', 'PASSED', 'PASSED', 'PASSED', '2026-08-15', '2027-02-15', 'NABL / OIML Class E2 Traceable Weight Set (1mg - 50kg)', 'CAL-CERT-2026-WT02', '±0.01% of span', true),
        ('eq-03', 'PAT-BLD-03', 'Stratified NIR Micro-Probe', 'Blending', 'Granulation Suite ISO 8 / Suite C', 'QUALIFIED', 'PASSED', 'PASSED', 'PASSED', '2026-07-20', '2027-01-20', 'Spectralon 99% Diffuse Reflectance Standard', 'CAL-CERT-2026-PAT03', '±0.05% RSD', true),
        ('eq-04', 'FBD-DRY-05', 'Fluidized Bed NIR & RTD Thermal Telemetry', 'Drying', 'Drying Suite ISO 8 / Suite D', 'QUALIFIED', 'PASSED', 'PASSED', 'PASSED', '2026-08-10', '2027-02-10', 'RTD Class A PT100 Calibrator & Karl Fischer Reference', 'CAL-CERT-2026-FBD05', '±0.2 °C Temp / ±0.1% LOD', true),
        ('eq-05', 'PRS-TAB-07', 'Rotary Tablet Press Force Transducer', 'Compression', 'Compression Suite ISO 7 / Suite E', 'QUALIFIED', 'PASSED', 'PASSED', 'PASSED', '2026-08-25', '2027-02-25', 'Piezoelectric Load Cell NIST Traceable Hydraulic Calibrator', 'CAL-CERT-2026-PRS07', '±0.1 kN Force', true),
        ('eq-06', 'VIS-CAM-08', '360° AI High-Speed Optical Vision Inspector', 'Final QC', 'Packaging & QC Lab ISO 8 / Suite F', 'QUALIFIED', 'PASSED', 'PASSED', 'PASSED', '2026-09-01', '2027-03-01', 'USAF 1951 Optical Resolution Target & Color Chart', 'CAL-CERT-2026-VIS08', '0.05 mm Defect Resolution', true)
        ON CONFLICT DO NOTHING;
      `);
    }

    const existingEnv = await pool.query('SELECT count(*) FROM environmental_monitoring');
    if (parseInt(existingEnv.rows[0].count, 10) === 0) {
      console.log('Seeding cleanroom HVAC environmental records...');
      await pool.query(`
        INSERT INTO environmental_monitoring 
        (id, suite_id, suite_name, cleanroom_grade, differential_pressure_pa, particle_count_05um, particle_count_50um, temperature_c, relative_humidity_pct, air_changes_per_hr, status, recorded_at)
        VALUES 
        ('env-01', 'SUITE-A', 'Raw Material Sampling Cleanroom', 'Grade C / ISO 7', 18.5, 124500, 820, 21.2, 44.5, 32.0, 'NORMAL', now() - interval '5 minutes'),
        ('env-02', 'SUITE-B', 'Dispensing & Weighing Suite', 'Grade C / ISO 7', 22.0, 98200, 640, 20.8, 42.1, 35.0, 'NORMAL', now() - interval '4 minutes'),
        ('env-03', 'SUITE-C', 'Wet Granulation & Fluid Bed Suite', 'Grade D / ISO 8', 15.2, 850400, 6200, 22.4, 46.8, 22.5, 'NORMAL', now() - interval '3 minutes'),
        ('env-04', 'SUITE-D', 'Tablet Compression Suite', 'Grade C / ISO 7', 24.8, 142100, 910, 21.0, 43.2, 34.0, 'NORMAL', now() - interval '2 minutes'),
        ('env-05', 'SUITE-E', 'Finished Product QC & Release Lab', 'Grade D / ISO 8', 16.4, 620300, 4800, 21.5, 45.0, 25.0, 'NORMAL', now() - interval '1 minute')
        ON CONFLICT DO NOTHING;
      `);
    }

    const existingPersonnel = await pool.query('SELECT count(*) FROM personnel_training');
    if (parseInt(existingPersonnel.rows[0].count, 10) === 0) {
      console.log('Seeding GMP personnel training records...');
      await pool.query(`
        INSERT INTO personnel_training 
        (id, employee_id, full_name, role, gmp_certification_level, sop_compliance_score, qualified_stages, qualification_status, last_training_date, next_refresher_date, supervisor_verification)
        VALUES 
        ('trn-01', 'EMP-GMP-101', 'V. Rajesh', 'Senior Process Chemist', 'GMP Level 3 (Master)', 99.4, '["Raw Material Receipt", "Dispensing", "Blending", "Granulation", "Drying", "Final Blending", "Compression", "Final QC"]', 'CERTIFIED', '2026-07-15', '2027-01-15', 'Dr. S. K. Narayanan (QA Head)'),
        ('trn-02', 'EMP-GMP-104', 'M. Anitha', 'Quality Control Officer', 'GMP Level 2 (Advanced)', 98.8, '["Raw Material Receipt", "Final Blending", "Final QC"]', 'CERTIFIED', '2026-08-01', '2027-02-01', 'K. Meenakshi (Lead QA Auditor)'),
        ('trn-03', 'EMP-GMP-109', 'S. Dinesh Kumar', 'Line Operator (Granulation & Compression)', 'GMP Level 2 (Advanced)', 97.5, '["Dispensing", "Granulation", "Drying", "Compression"]', 'CERTIFIED', '2026-08-20', '2027-02-20', 'V. Rajesh (Senior Process Chemist)'),
        ('trn-04', 'EMP-GMP-201', 'Dr. S. K. Narayanan', 'Director of Quality Assurance', 'GMP Level 3 (QP / QA Executive)', 100.0, '["ALL_STAGES_QA_RELEASE_AUTHORITY"]', 'CERTIFIED', '2026-06-01', '2027-06-01', 'Executive Board Certification')
        ON CONFLICT DO NOTHING;
      `);
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
