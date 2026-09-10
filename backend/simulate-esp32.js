/**
 * simulate-esp32.js
 * Multi-Stage IoT & Pharmaceutical Instrument Sensor Simulator
 *
 * Simulates real-time sensor streams from actual pharma PAT instruments:
 * - Stage 1: InGaAs FT-NIR Spectrometer & Halogen Moisture Analyzer
 * - Stage 2: Digital Load Cell Analytical Balance & Cleanroom RH/Temp
 * - Stage 3: Stratified NIR Multi-Point Probe & Blender Optical Tachometer
 * - Stage 4: High-Shear Motor Torque Transducer & Binder Mass Flow Meter
 * - Stage 5: In-Situ Fluid Bed LOD Probe & Inlet/Outlet Thermal RTDs
 * - Stage 6: Lubrication Homogeneity NIR Probe & Cycle Timer
 * - Stage 7: Rotary Press Piezo Force Sensor & Automated Tablet IPC Tester
 * - Stage 8: 360° AI High-Speed Optical Vision Camera & In-Line HPLC
 */

const SERVER_BASE = process.env.SERVER_URL ? process.env.SERVER_URL.replace('/api/sensor-data', '') : 'http://localhost:3000';
const SEND_INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '10000', 10); // every 10 seconds

function randomInRange(min, max, decimals = 2) {
  return +(min + Math.random() * (max - min)).toFixed(decimals);
}

function pickMode() {
  const roll = Math.random();
  if (roll < 0.85) return 'pass';
  if (roll < 0.95) return 'warning';
  return 'critical';
}

const STAGE_SENSORS = {
  1: {
    stage: 'Raw Material Receipt',
    deviceId: 'PAT-NIR-SPEC-01',
    instrument: 'FT-NIR Spectrometer & LOD Core',
    generate(mode = 'pass') {
      const isPass = mode === 'pass';
      return [
        {
          name: 'NIR Spectral Identity (R)',
          parameter: 'NIR Spectral Identity (R)',
          value: isPass ? randomInRange(0.985, 0.998, 4) : randomInRange(0.82, 0.91, 4),
          unit: 'Pearson R',
          instrument: 'FT-NIR Spectrometer (PAT-01)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Residual Moisture (LOD)',
          parameter: 'Residual Moisture (LOD)',
          value: isPass ? randomInRange(1.10, 1.45, 2) : randomInRange(2.20, 2.70, 2),
          unit: '%',
          instrument: 'Halogen Moisture Analyzer (LOD-01)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Container Barcode Reconciliation',
          parameter: 'Container Barcode Reconciliation',
          value: `BC-RM-${randomInRange(1000, 9999, 0)}-01`,
          unit: 'ID',
          instrument: '2D Optical Matrix Scanner (BC-01)',
          result: 'PASS'
        }
      ];
    }
  },
  2: {
    stage: 'Dispensing',
    deviceId: 'SCALE-LOAD-02',
    instrument: 'Certified Dual Load Cell Platform',
    generate(mode = 'pass') {
      const isPass = mode === 'pass';
      const dev = isPass ? randomInRange(0.10, 0.35, 2) : randomInRange(1.20, 2.40, 2);
      return [
        {
          name: 'Dispense Weight Tolerance',
          parameter: 'Dispense Weight Tolerance',
          value: dev,
          unit: '% Dev',
          instrument: 'Certified Analytical Balance (WT-02)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Actual Weighed Quantity',
          parameter: 'Actual Weighed Quantity',
          value: +(50.0 * (1 + dev / 100)).toFixed(3),
          unit: 'kg',
          instrument: 'Digital Load Cell Platform',
          result: 'PASS'
        },
        {
          name: 'Cleanroom Relative Humidity',
          parameter: 'Cleanroom Relative Humidity',
          value: randomInRange(41.0, 44.5, 1),
          unit: '% RH',
          instrument: 'Vaisala Humidity Transmitter (ENV-02)',
          result: 'PASS'
        },
        {
          name: 'Cleanroom Temperature',
          parameter: 'Cleanroom Temperature',
          value: randomInRange(21.0, 22.2, 1),
          unit: '°C',
          instrument: 'Cleanroom RTD Thermal Probe (ENV-02)',
          result: 'PASS'
        }
      ];
    }
  },
  3: {
    stage: 'Blending',
    deviceId: 'PAT-PROBE-03',
    instrument: 'NIR Stratified Blend Probe & Tachometer',
    generate(mode = 'pass') {
      const isPass = mode === 'pass';
      return [
        {
          name: 'Blend Uniformity RSD',
          parameter: 'Blend Uniformity RSD',
          value: isPass ? randomInRange(1.8, 3.2, 1) : randomInRange(5.4, 7.2, 1),
          unit: '%',
          instrument: 'In-Situ NIR Multi-Point Probe (PAT-03)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Homogeneity Index',
          parameter: 'Homogeneity Index',
          value: isPass ? randomInRange(96.5, 98.8, 1) : randomInRange(88.0, 93.5, 1),
          unit: '%',
          instrument: 'Chemometric Homogeneity Analyzer (PAT-03)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Blender Speed',
          parameter: 'Blender Speed',
          value: randomInRange(23.5, 24.5, 1),
          unit: 'RPM',
          instrument: 'V-Blender Optical Tachometer (TACH-03)',
          result: 'PASS'
        },
        {
          name: 'Mixing Duration',
          parameter: 'Mixing Duration',
          value: randomInRange(14.5, 15.5, 1),
          unit: 'min',
          instrument: 'Automated Process Timer (TMR-03)',
          result: 'PASS'
        }
      ];
    }
  },
  4: {
    stage: 'Granulation',
    deviceId: 'GRAN-SENS-04',
    instrument: 'High-Shear Torque & Mass Flow Sensor',
    generate(mode = 'pass') {
      const isPass = mode === 'pass';
      return [
        {
          name: 'Impeller Torque Peak',
          parameter: 'Impeller Torque Peak',
          value: isPass ? randomInRange(14.5, 16.5, 1) : randomInRange(9.5, 11.2, 1),
          unit: 'Nm',
          instrument: 'High-Shear Impeller Torque Sensor (TRQ-04)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Wet Mass Consistency',
          parameter: 'Wet Mass Consistency',
          value: isPass ? randomInRange(93.0, 96.0, 1) : randomInRange(82.0, 88.0, 1),
          unit: '%',
          instrument: 'Torque-Curve Rheology Analyzer (VSC-04)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Binder Spray Rate',
          parameter: 'Binder Spray Rate',
          value: randomInRange(44.0, 46.5, 1),
          unit: 'g/min',
          instrument: 'Mass Flow Peristaltic Sensor (FLW-04)',
          result: 'PASS'
        },
        {
          name: 'Atomization Air Pressure',
          parameter: 'Atomization Air Pressure',
          value: randomInRange(1.7, 1.9, 2),
          unit: 'bar',
          instrument: 'Digital Pressure Transducer (PRS-04)',
          result: 'PASS'
        }
      ];
    }
  },
  5: {
    stage: 'Drying',
    deviceId: 'FBD-NIR-05',
    instrument: 'Fluid Bed LOD & Thermal RTDs',
    generate(mode = 'pass') {
      const isPass = mode === 'pass';
      return [
        {
          name: 'Loss on Drying (LOD)',
          parameter: 'Loss on Drying (LOD)',
          value: isPass ? randomInRange(1.80, 2.10, 2) : randomInRange(2.65, 3.10, 2),
          unit: '%',
          instrument: 'In-Situ Microwave/NIR Probe (FBD-05)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Inlet Air Temperature',
          parameter: 'Inlet Air Temperature',
          value: randomInRange(57.5, 60.5, 1),
          unit: '°C',
          instrument: 'Inlet Thermal RTD Sensor (RTD-IN-05)',
          result: 'PASS'
        },
        {
          name: 'Outlet Air Temperature',
          parameter: 'Outlet Air Temperature',
          value: randomInRange(41.5, 43.5, 1),
          unit: '°C',
          instrument: 'Exhaust Air RTD Sensor (RTD-OUT-05)',
          result: 'PASS'
        },
        {
          name: 'Fluidization Airflow Velocity',
          parameter: 'Fluidization Airflow Velocity',
          value: randomInRange(330, 355, 0),
          unit: 'm³/hr',
          instrument: 'Differential Pressure Transmitter (AF-05)',
          result: 'PASS'
        }
      ];
    }
  },
  6: {
    stage: 'Final Blending',
    deviceId: 'LUB-PAT-06',
    instrument: 'Lubricant Coating Spectrophotometer',
    generate(mode = 'pass') {
      const isPass = mode === 'pass';
      return [
        {
          name: 'Lubrication Blend RSD',
          parameter: 'Lubrication Blend RSD',
          value: isPass ? randomInRange(1.8, 2.4, 1) : randomInRange(4.5, 5.8, 1),
          unit: '%',
          instrument: 'In-Line NIR Lubrication Probe (LUB-06)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Lubricant Coating Index',
          parameter: 'Lubricant Coating Index',
          value: isPass ? randomInRange(97.0, 99.2, 1) : randomInRange(88.0, 93.0, 1),
          unit: '%',
          instrument: 'Surface Coating Efficiency Analyzer (SCA-06)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Rotational Speed',
          parameter: 'Rotational Speed',
          value: randomInRange(11.5, 12.5, 1),
          unit: 'RPM',
          instrument: 'Low-Shear Blender Tachometer (TACH-06)',
          result: 'PASS'
        },
        {
          name: 'Blending Duration',
          parameter: 'Blending Duration',
          value: randomInRange(4.6, 5.0, 1),
          unit: 'min',
          instrument: 'Digital Cycle Timer (TMR-06)',
          result: 'PASS'
        }
      ];
    }
  },
  7: {
    stage: 'Compression',
    deviceId: 'IPC-PRESS-07',
    instrument: 'Rotary Press Strain Gauge & Tablet Tester',
    generate(mode = 'pass') {
      const isPass = mode === 'pass';
      return [
        {
          name: 'Main Compression Force',
          parameter: 'Main Compression Force',
          value: isPass ? randomInRange(16.0, 17.5, 1) : randomInRange(11.0, 13.0, 1),
          unit: 'kN',
          instrument: 'Rotary Press Piezoelectric Sensor (PRS-FC-07)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Tablet Hardness',
          parameter: 'Tablet Hardness',
          value: isPass ? randomInRange(9.0, 10.5, 1),
          unit: 'Kp',
          instrument: 'Automated Tablet Hardness Tester (HRD-07)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Tablet Individual Weight',
          parameter: 'Tablet Individual Weight',
          value: isPass ? randomInRange(498.0, 503.0, 1) : randomInRange(475.0, 485.0, 1),
          unit: 'mg',
          instrument: 'In-Line IPC Analytical Balance (WT-07)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Friability',
          parameter: 'Friability',
          value: isPass ? randomInRange(0.15, 0.28, 2) : randomInRange(1.10, 1.45, 2),
          unit: '%',
          instrument: 'Digital Friabilator Sensor (FRB-07)',
          result: isPass ? 'PASS' : 'WARNING'
        }
      ];
    }
  },
  8: {
    stage: 'Final QC',
    deviceId: 'AI-CAM-QC-08',
    instrument: '360° AI Optical Camera & HPLC Assay',
    generate(mode = 'pass') {
      const isPass = mode === 'pass';
      return [
        {
          name: 'Active Assay',
          parameter: 'Active Assay',
          value: isPass ? randomInRange(99.2, 100.5, 1) : randomInRange(94.0, 96.5, 1),
          unit: '%',
          instrument: 'Automated In-Line HPLC Chromatography (HPLC-08)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Dissolution at 30 min',
          parameter: 'Dissolution at 30 min',
          value: isPass ? randomInRange(93.0, 96.5, 1) : randomInRange(72.0, 78.0, 1),
          unit: '%',
          instrument: 'Automated Fiber-Optic Dissolution Telemetry (DIS-08)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Visual Defect Rate',
          parameter: 'Visual Defect Rate',
          value: isPass ? randomInRange(0.01, 0.04, 2) : randomInRange(0.15, 0.35, 2),
          unit: '%',
          instrument: '360° High-Speed Optical Inspection Camera (CAM-AI-08)',
          result: isPass ? 'PASS' : 'WARNING'
        },
        {
          name: 'Batch Quality Score',
          parameter: 'Batch Quality Score',
          value: isPass ? randomInRange(95, 99, 0) : randomInRange(74, 82, 0),
          unit: 'Score',
          instrument: '21 CFR Part 11 Automated Compliance Engine',
          result: isPass ? 'PASS' : 'WARNING'
        }
      ];
    }
  }
};

let currentBatchId = null;

async function fetchActiveBatchId() {
  try {
    const res = await fetch(`${SERVER_BASE}/api/projects`);
    if (res.ok) {
      const batches = await res.json();
      if (Array.isArray(batches) && batches.length > 0) {
        return batches[0].id;
      }
    }
  } catch (e) {
    // Ignore error
  }
  return 'id-batch-active';
}

let stageCounter = 1;

async function streamSensorData() {
  if (!currentBatchId) {
    currentBatchId = await fetchActiveBatchId();
  }

  const stageNum = stageCounter;
  stageCounter = (stageCounter % 8) + 1;

  const stageConfig = STAGE_SENSORS[stageNum];
  const mode = pickMode();
  const readings = stageConfig.generate(mode);

  try {
    const res = await fetch(`${SERVER_BASE}/api/batches/${currentBatchId}/stage-sensor-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: stageConfig.stage,
        deviceId: stageConfig.deviceId,
        operator: `IoT Telemetry (${stageConfig.instrument})`,
        readings
      })
    });

    if (res.ok) {
      const data = await res.json();
      console.log(
        `[${new Date().toLocaleTimeString()}] Stage ${stageNum} (${stageConfig.stage}) -> Ingested ${readings.length} channels from [${stageConfig.deviceId}] | Mode: ${mode.toUpperCase()} (Saved: ${data.savedCount})`
      );
    } else {
      const errData = await res.json();
      console.warn(`[${new Date().toLocaleTimeString()}] Server warning on Stage ${stageNum}:`, errData);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Failed to stream sensor telemetry for Stage ${stageNum}:`, err.message);
  }
}

console.log('=====================================================');
console.log('  8-Stage IoT & Pharmaceutical Sensor Telemetry Engine');
console.log(`  Target Backend: ${SERVER_BASE}`);
console.log(`  Streaming Interval: every ${SEND_INTERVAL_MS / 1000}s`);
console.log('  Active Stages: 1 through 8 (Continuous multi-sensor streams)');
console.log('=====================================================\n');

streamSensorData();
setInterval(streamSensorData, SEND_INTERVAL_MS);
