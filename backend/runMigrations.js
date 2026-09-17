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

    // Ensure devices table exists and has rich topology & telemetry mapping columns
    await safeAlter(`
      CREATE TABLE IF NOT EXISTS devices (
        device_id VARCHAR(255) PRIMARY KEY,
        api_key VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        model VARCHAR(255),
        category VARCHAR(100) DEFAULT 'Spectroscopy',
        connection_type VARCHAR(100) DEFAULT 'HTTP REST',
        protocol VARCHAR(100) DEFAULT 'HTTP REST',
        endpoint_url VARCHAR(500),
        process_stage VARCHAR(255) DEFAULT 'Raw Material Receipt',
        station_id VARCHAR(255),
        line_name VARCHAR(255),
        monitoring_point_id VARCHAR(255),
        captured_parameters JSONB,
        sample_rate VARCHAR(100) DEFAULT '10s',
        status VARCHAR(50) DEFAULT 'active',
        last_seen_at TIMESTAMPTZ,
        registered_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS model VARCHAR(255);`);
    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Spectroscopy';`);
    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS protocol VARCHAR(100) DEFAULT 'HTTP REST';`);
    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS endpoint_url VARCHAR(500);`);
    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS process_stage VARCHAR(255);`);
    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS station_id VARCHAR(255);`);
    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS line_name VARCHAR(255);`);
    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS captured_parameters JSONB;`);
    await safeAlter(`ALTER TABLE devices ADD COLUMN IF NOT EXISTS sample_rate VARCHAR(100) DEFAULT '10s';`);

    // Seed standard PAT pharmaceutical sensors
    console.log('Verifying standard PAT pharmaceutical sensors in database...');
    const defaultSensors = [
        {
          device_id: 'PAT-NIR-01',
          api_key: 'key-pat-nir-01-prod',
          name: 'InGaAs FT-NIR Fiber Spectrometer',
          model: 'Brimrose Luminar 5030 InGaAs Core',
          category: 'NIR Spectroscopy',
          connection_type: 'HTTP REST',
          protocol: 'HTTP REST (JSON)',
          endpoint_url: 'http://192.168.1.101:8080/api/nir',
          process_stage: 'Raw Material Receipt',
          station_id: 'STATION-01 (RM Receipt Suite)',
          line_name: 'Line 1 (Granulation)',
          sample_rate: '5s',
          status: 'active',
          captured_parameters: JSON.stringify([
            { name: 'NIR Spectral Identity (R)', unit: 'Pearson R', dataType: 'Spectrum', minSpec: 0.98, maxSpec: 1.00, target: 0.995, description: 'FT-NIR Correlation Match vs Reference' },
            { name: 'Residual Moisture (LOD)', unit: '%', dataType: 'Float', minSpec: 0.5, maxSpec: 2.0, target: 1.25, description: 'Halogen In-Situ Moisture LOD' },
            { name: 'Container Barcode Reconciliation', unit: 'ID', dataType: 'Barcode', description: '2D DataMatrix Verification' }
          ])
        },
        {
          device_id: 'SCALE-WT-02',
          api_key: 'key-scale-wt-02-prod',
          name: 'Certified Dual Load Cell Balance',
          model: 'Mettler Toledo PBK989 High-Precision Load Cell',
          category: 'Gravimetric / Load Cell',
          connection_type: 'RS485',
          protocol: 'Modbus TCP / RS485',
          endpoint_url: '192.168.1.102:502 (Node 02)',
          process_stage: 'Dispensing',
          station_id: 'STATION-02 (Dispensing Weighing Booth)',
          line_name: 'Line 1 (Granulation)',
          sample_rate: '1s',
          status: 'active',
          captured_parameters: JSON.stringify([
            { name: 'Dispense Weight Tolerance', unit: '% Dev', dataType: 'Float', minSpec: -1.0, maxSpec: 1.0, target: 0.0, description: 'Deviation from Formulated Target' },
            { name: 'Actual Weighed Quantity', unit: 'kg', dataType: 'Float', target: 50.0, description: 'Gravimetric Dispensed Weight' },
            { name: 'Cleanroom Relative Humidity', unit: '% RH', dataType: 'Float', minSpec: 35.0, maxSpec: 50.0, target: 45.0, description: 'Vaisala RH Transmitter' },
            { name: 'Cleanroom Temperature', unit: '°C', dataType: 'Float', minSpec: 19.0, maxSpec: 24.0, target: 21.5, description: 'Cleanroom RTD Probe' }
          ])
        },
        {
          device_id: 'PAT-BLEND-03',
          api_key: 'key-pat-blend-03-prod',
          name: 'Stratified NIR Pre-Blending Probe',
          model: 'Viavi MicroNIR PAT-U In-Situ Probe',
          category: 'NIR Spectroscopy',
          connection_type: 'HTTP REST',
          protocol: 'HTTP REST (JSON)',
          endpoint_url: 'http://192.168.1.103:8080/api/blend',
          process_stage: 'Blending',
          station_id: 'STATION-03 (V-Blender Suite)',
          line_name: 'Line 1 (Granulation)',
          sample_rate: '2s',
          status: 'active',
          captured_parameters: JSON.stringify([
            { name: 'Blend Uniformity RSD', unit: '% RSD', dataType: 'Float', minSpec: 0.0, maxSpec: 5.0, target: 2.1, description: 'Relative Standard Deviation (RSD)' },
            { name: 'Homogeneity Index', unit: '%', dataType: 'Float', minSpec: 95.0, maxSpec: 100.0, target: 99.2, description: 'API Blend Uniformity' },
            { name: 'Blender Speed', unit: 'RPM', dataType: 'Integer', minSpec: 15, maxSpec: 25, target: 20, description: 'Optical Tachometer' },
            { name: 'Mixing Duration', unit: 'min', dataType: 'Float', minSpec: 10.0, maxSpec: 20.0, target: 15.0, description: 'Cumulative Blender Cycle Time' }
          ])
        },
        {
          device_id: 'GRAN-TORQ-04',
          api_key: 'key-gran-torq-04-prod',
          name: 'High-Shear Torque & Rheology Transducer',
          model: 'Glatt VG-65 In-Line Motor Torque Sensor',
          category: 'Torque / Rheology',
          connection_type: 'Modbus TCP',
          protocol: 'Modbus TCP (Port 502)',
          endpoint_url: '192.168.1.104:502',
          process_stage: 'Granulation',
          station_id: 'STATION-04 (High-Shear Granulator)',
          line_name: 'Line 1 (Granulation)',
          sample_rate: '500ms',
          status: 'active',
          captured_parameters: JSON.stringify([
            { name: 'Impeller Torque Peak', unit: 'Nm', dataType: 'Float', minSpec: 12.0, maxSpec: 18.0, target: 15.2, description: 'End-point Granulation Rheology Curve' },
            { name: 'Wet Mass Consistency', unit: 'mN·m', dataType: 'Float', minSpec: 85.0, maxSpec: 100.0, target: 94.5, description: 'Impeller Power Consumption' },
            { name: 'Binder Spray Rate', unit: 'g/min', dataType: 'Float', minSpec: 45.0, maxSpec: 55.0, target: 50.0, description: 'Peristaltic Pump Flow Rate' },
            { name: 'Atomization Air Pressure', unit: 'bar', dataType: 'Float', minSpec: 1.8, maxSpec: 2.4, target: 2.1, description: 'Spray Nozzle Atomization Air' }
          ])
        },
        {
          device_id: 'FBD-NIR-05',
          api_key: 'key-fbd-nir-05-prod',
          name: 'Fluid Bed In-Situ NIR & Thermal RTD',
          model: 'GEA Multi-Point Fluid Bed Fiber Probe',
          category: 'Thermal & Moisture',
          connection_type: 'HTTP REST',
          protocol: 'HTTP REST (JSON)',
          endpoint_url: 'http://192.168.1.105:8080/api/fbd',
          process_stage: 'Drying',
          station_id: 'STATION-05 (Fluid Bed Dryer FBD-01)',
          line_name: 'Line 1 (Granulation)',
          sample_rate: '5s',
          status: 'active',
          captured_parameters: JSON.stringify([
            { name: 'Loss on Drying (LOD)', unit: '%', dataType: 'Float', minSpec: 1.0, maxSpec: 2.5, target: 1.8, description: 'Fluid Bed Granule Residual Moisture' },
            { name: 'Inlet Air Temperature', unit: '°C', dataType: 'Float', minSpec: 55.0, maxSpec: 65.0, target: 60.0, description: 'Inlet Heating RTD Pt100' },
            { name: 'Outlet Air Temperature', unit: '°C', dataType: 'Float', minSpec: 38.0, maxSpec: 44.0, target: 41.0, description: 'Exhaust Air Thermocouple' },
            { name: 'Fluidization Airflow Velocity', unit: 'm/s', dataType: 'Float', minSpec: 2.2, maxSpec: 3.2, target: 2.8, description: 'Hot Wire Anemometer' }
          ])
        },
        {
          device_id: 'LUB-SPEC-06',
          api_key: 'key-lub-spec-06-prod',
          name: 'Lubricant Coating Spectrophotometer',
          model: 'FOSS InGaAs Diffuse Reflectance Sensor',
          category: 'NIR Spectroscopy',
          connection_type: 'HTTP REST',
          protocol: 'HTTP REST (JSON)',
          endpoint_url: 'http://192.168.1.106:8080/api/lub',
          process_stage: 'Final Blending',
          station_id: 'STATION-06 (Final Cone Blender)',
          line_name: 'Line 1 (Granulation)',
          sample_rate: '5s',
          status: 'active',
          captured_parameters: JSON.stringify([
            { name: 'Lubrication Blend RSD', unit: '% RSD', dataType: 'Float', minSpec: 0.0, maxSpec: 4.0, target: 1.8, description: 'Magnesium Stearate Coating Uniformity' },
            { name: 'Lubricant Coating Index', unit: '%', dataType: 'Float', minSpec: 96.0, maxSpec: 100.0, target: 98.6, description: 'Surface Hydrophobic Uniformity' },
            { name: 'Rotational Speed', unit: 'RPM', dataType: 'Integer', minSpec: 10, maxSpec: 18, target: 14, description: 'Blender Tachometer' },
            { name: 'Blending Duration', unit: 'min', dataType: 'Float', minSpec: 4.0, maxSpec: 8.0, target: 5.0, description: 'Lubrication Timing Window' }
          ])
        },
        {
          device_id: 'PRS-PIEZO-07',
          api_key: 'key-prs-piezo-07-prod',
          name: 'Rotary Press Piezoelectric Sensor',
          model: 'Fette Compacting Piezo Load Cell & IPC Multi-Check',
          category: 'Piezoelectric / Force',
          connection_type: 'Modbus TCP',
          protocol: 'Modbus TCP / Ethernet',
          endpoint_url: '192.168.1.107:502',
          process_stage: 'Compression',
          station_id: 'STATION-07 (Rotary Tablet Press Suite)',
          line_name: 'Line 1 (Granulation)',
          sample_rate: '100ms',
          status: 'active',
          captured_parameters: JSON.stringify([
            { name: 'Main Compression Force', unit: 'kN', dataType: 'Float', minSpec: 15.0, maxSpec: 22.0, target: 18.5, description: 'Punch Compression Force' },
            { name: 'Tablet Hardness', unit: 'kp / N', dataType: 'Float', minSpec: 8.0, maxSpec: 14.0, target: 11.2, description: 'In-Process Tablet Hardness Tester' },
            { name: 'Tablet Individual Weight', unit: 'mg', dataType: 'Float', minSpec: 485.0, maxSpec: 515.0, target: 500.0, description: 'High-Speed Automated Checkweigher' },
            { name: 'Friability', unit: '%', dataType: 'Float', minSpec: 0.0, maxSpec: 0.8, target: 0.22, description: 'USP Tablet Friability Tester' }
          ])
        },
        {
          device_id: 'QC-OPT-08',
          api_key: 'key-qc-opt-08-prod',
          name: '360° AI High-Speed Optical Vision & HPLC',
          model: 'Cognex In-Sight 3D AI Camera & In-Line HPLC',
          category: 'Vision Camera & HPLC',
          connection_type: 'HTTP REST',
          protocol: 'HTTP REST / Vision Stream',
          endpoint_url: 'http://192.168.1.108:8080/api/vision',
          process_stage: 'Final QC',
          station_id: 'STATION-08 (Inspection & Release QA)',
          line_name: 'Line 1 (Granulation)',
          sample_rate: '100ms',
          status: 'active',
          captured_parameters: JSON.stringify([
            { name: 'Active Assay', unit: '% Label Claim', dataType: 'Float', minSpec: 98.0, maxSpec: 102.0, target: 99.8, description: 'In-Line HPLC API Concentration' },
            { name: 'Dissolution at 30 min', unit: '% Q', dataType: 'Float', minSpec: 80.0, maxSpec: 100.0, target: 92.4, description: 'Automated UV Dissolution' },
            { name: 'Visual Defect Rate', unit: '% Defective', dataType: 'Float', minSpec: 0.0, maxSpec: 0.1, target: 0.0, description: '360° Vision AI Surface Defect Detection' },
            { name: 'Batch Quality Score', unit: 'Score / 100', dataType: 'Integer', minSpec: 90, maxSpec: 100, target: 98, description: '21 CFR Part 11 Automated Holistic Quality Index' }
          ])
        }
      ];

      for (const s of defaultSensors) {
        await pool.query(
          `INSERT INTO devices (device_id, api_key, name, model, category, connection_type, protocol, endpoint_url, process_stage, station_id, line_name, sample_rate, status, captured_parameters, registered_at, last_seen_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
           ON CONFLICT (device_id) DO UPDATE SET
             name = EXCLUDED.name,
             model = EXCLUDED.model,
             category = EXCLUDED.category,
             protocol = EXCLUDED.protocol,
             endpoint_url = EXCLUDED.endpoint_url,
             process_stage = EXCLUDED.process_stage,
             station_id = EXCLUDED.station_id,
             line_name = EXCLUDED.line_name,
             captured_parameters = EXCLUDED.captured_parameters`,
          [s.device_id, s.api_key, s.name, s.model, s.category, s.connection_type, s.protocol, s.endpoint_url, s.process_stage, s.station_id, s.line_name, s.sample_rate, s.status, s.captured_parameters]
        );
      }

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
