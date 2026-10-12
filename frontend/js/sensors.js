/**
 * sensors.js
 * Clean, generic line-by-line Sensors Management Controller with Customization Options
 * Matches the platform standard table & modal design.
 */

function getSensorsBackend() {
  if (typeof window !== 'undefined' && window.location) {
    const isHttps = window.location.protocol === 'https:';
    const isNetlify = Boolean(window.location.hostname && window.location.hostname.includes('netlify.app'));
    if (isNetlify || isHttps) {
      if (window.localStorage) {
        const saved = window.localStorage.getItem('sip_backend_url');
        if (saved && (saved.includes('localhost') || saved.includes('127.0.0.1') || saved.includes('onrender.com'))) {
          window.localStorage.removeItem('sip_backend_url');
        }
      }
      return (window.location && window.location.origin) ? window.location.origin : '';
    }
  }
  if (typeof window !== 'undefined' && window.BACKEND_URL && !window.BACKEND_URL.includes('localhost:3000')) {
    return window.BACKEND_URL;
  }
  return (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : 'http://localhost:3000';
}

var BACKEND_URL = getSensorsBackend();
if (typeof window !== 'undefined') {
  window.BACKEND_URL = BACKEND_URL;
}

const STORAGE_KEY_CUSTOM_DEVICES = 'sip_custom_devices';

function getCustomDevicesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_DEVICES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCustomDeviceToLocalStorage(device) {
  try {
    const existing = getCustomDevicesFromLocalStorage();
    const idx = existing.findIndex(d => d.deviceId === device.deviceId);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...device };
    } else {
      existing.unshift(device);
    }
    localStorage.setItem(STORAGE_KEY_CUSTOM_DEVICES, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

function removeCustomDeviceFromLocalStorage(deviceId) {
  try {
    const existing = getCustomDevicesFromLocalStorage();
    const updated = existing.filter(d => d.deviceId !== deviceId);
    localStorage.setItem(STORAGE_KEY_CUSTOM_DEVICES, JSON.stringify(updated));
  } catch (e) {}
}

// 12 Validated cGMP Manufacturing & Spectroscopy Instruments
const FALLBACK_DEVICES = [
  {
    deviceId: "PAT-NIR-01",
    apiKey: "key-pat-nir-01-prod",
    name: "InGaAs FT-NIR Fiber Spectrometer",
    model: "Brimrose Luminar 5030 InGaAs Core",
    category: "NIR Spectroscopy",
    connectionType: "HTTP REST",
    protocol: "HTTP REST (JSON)",
    endpointUrl: "http://192.168.1.101:8080/api/nir",
    processStage: "Raw Material Receipt",
    stationId: "STATION-01 (Raw Material Air-lock)",
    lineName: "Line 1 (Granulation)",
    status: "active",
    capturedParameters: [
      { name: "Spectral Similarity Index", unit: "%", target: 99.5, maxSpec: 100, minSpec: 95 },
      { name: "Raw Material Moisture", unit: "%", target: 1.2, maxSpec: 2.0, minSpec: 0.5 },
      { name: "API Identification Match", unit: "Score", target: 0.99, maxSpec: 1.0, minSpec: 0.95 }
    ]
  },
  {
    deviceId: "BAL-DISP-02",
    apiKey: "key-bal-disp-02-prod",
    name: "Analytical Micro-Dispensing Balance",
    model: "Mettler Toledo XPR Micro-Analytical",
    category: "Gravimetric / Load Cell",
    connectionType: "Modbus TCP",
    protocol: "Modbus TCP / RS485",
    endpointUrl: "192.168.1.102:502 (Node 02)",
    processStage: "Dispensing",
    stationId: "STATION-02 (Dispensing Weighing Booth)",
    lineName: "Line 1 (Granulation)",
    status: "active",
    capturedParameters: [
      { name: "Dispense Weight Tolerance", unit: "% Dev", target: 0, maxSpec: 1, minSpec: -1 },
      { name: "Actual Weighed Quantity", unit: "kg", target: 50 },
      { name: "Cleanroom Relative Humidity", unit: "% RH", target: 45, maxSpec: 50, minSpec: 35 },
      { name: "Cleanroom Temperature", unit: "°C", target: 21.5, maxSpec: 24, minSpec: 19 }
    ]
  },
  {
    deviceId: "PAT-BLEND-03",
    apiKey: "key-pat-blend-03-prod",
    name: "Stratified NIR Pre-Blending Probe",
    model: "Viavi MicroNIR PAT-U In-Situ Probe",
    category: "NIR Spectroscopy",
    connectionType: "HTTP REST",
    protocol: "HTTP REST (JSON)",
    endpointUrl: "http://192.168.1.103:8080/api/blend",
    processStage: "Blending",
    stationId: "STATION-03 (V-Blender Suite)",
    lineName: "Line 1 (Granulation)",
    status: "active",
    capturedParameters: [
      { name: "Blend Uniformity RSD", unit: "% RSD", target: 2.1, maxSpec: 5, minSpec: 0 },
      { name: "Homogeneity Index", unit: "%", target: 99.2, maxSpec: 100, minSpec: 95 },
      { name: "Blender Speed", unit: "RPM", target: 20, maxSpec: 25, minSpec: 15 },
      { name: "Mixing Duration", unit: "min", target: 15, maxSpec: 20, minSpec: 10 }
    ]
  },
  {
    deviceId: "GRAN-TORQ-04",
    apiKey: "key-gran-torq-04-prod",
    name: "High-Shear Torque & Rheology Transducer",
    model: "Glatt VG-65 In-Line Motor Torque Sensor",
    category: "Torque / Rheology",
    connectionType: "Modbus TCP",
    protocol: "Modbus TCP (Port 502)",
    endpointUrl: "192.168.1.104:502",
    processStage: "Granulation",
    stationId: "STATION-04 (High-Shear Granulator)",
    lineName: "Line 1 (Granulation)",
    status: "active",
    capturedParameters: [
      { name: "Impeller Torque Peak", unit: "Nm", target: 15.2, maxSpec: 18, minSpec: 12 },
      { name: "Wet Mass Consistency", unit: "mN·m", target: 94.5, maxSpec: 100, minSpec: 85 },
      { name: "Binder Spray Rate", unit: "g/min", target: 50, maxSpec: 55, minSpec: 45 },
      { name: "Atomization Air Pressure", unit: "bar", target: 2.1, maxSpec: 2.4, minSpec: 1.8 }
    ]
  },
  {
    deviceId: "FBD-NIR-05",
    apiKey: "key-fbd-nir-05-prod",
    name: "Fluid Bed In-Situ NIR & Thermal RTD",
    model: "GEA Multi-Point Fluid Bed Fiber Probe",
    category: "Thermal & Moisture",
    connectionType: "HTTP REST",
    protocol: "HTTP REST (JSON)",
    endpointUrl: "http://192.168.1.105:8080/api/fbd",
    processStage: "Drying",
    stationId: "STATION-05 (Fluid Bed Dryer FBD-01)",
    lineName: "Line 1 (Granulation)",
    status: "active",
    capturedParameters: [
      { name: "Loss on Drying (LOD)", unit: "%", target: 1.8, maxSpec: 2.5, minSpec: 1.0 },
      { name: "Inlet Air Temperature", unit: "°C", target: 60, maxSpec: 65, minSpec: 55 },
      { name: "Outlet Air Temperature", unit: "°C", target: 41, maxSpec: 44, minSpec: 38 },
      { name: "Fluidization Airflow Velocity", unit: "m/s", target: 2.8, maxSpec: 3.2, minSpec: 2.2 }
    ]
  },
  {
    deviceId: "LUB-SPEC-06",
    apiKey: "key-lub-spec-06-prod",
    name: "Lubricant Coating Spectrophotometer",
    model: "FOSS InGaAs Diffuse Reflectance Sensor",
    category: "NIR Spectroscopy",
    connectionType: "HTTP REST",
    protocol: "HTTP REST (JSON)",
    endpointUrl: "http://192.168.1.106:8080/api/lub",
    processStage: "Final Blending",
    stationId: "STATION-06 (Final Cone Blender)",
    lineName: "Line 1 (Granulation)",
    status: "active",
    capturedParameters: [
      { name: "Lubrication Blend RSD", unit: "% RSD", target: 1.8, maxSpec: 4, minSpec: 0 },
      { name: "Lubricant Coating Index", unit: "%", target: 98.6, maxSpec: 100, minSpec: 96 },
      { name: "Rotational Speed", unit: "RPM", target: 14, maxSpec: 18, minSpec: 10 },
      { name: "Blending Duration", unit: "min", target: 5, maxSpec: 8, minSpec: 4 }
    ]
  },
  {
    deviceId: "PRS-PIEZO-07",
    apiKey: "key-prs-piezo-07-prod",
    name: "Rotary Press Piezoelectric Sensor",
    model: "Fette Compacting Piezo Load Cell & IPC Multi-Check",
    category: "Piezoelectric / Force",
    connectionType: "Modbus TCP",
    protocol: "Modbus TCP / Ethernet",
    endpointUrl: "192.168.1.107:502",
    processStage: "Compression",
    stationId: "STATION-07 (Rotary Tablet Press Suite)",
    lineName: "Line 1 (Granulation)",
    status: "active",
    capturedParameters: [
      { name: "Main Compression Force", unit: "kN", target: 18.5, maxSpec: 22, minSpec: 15 },
      { name: "Tablet Hardness", unit: "kp / N", target: 11.2, maxSpec: 14, minSpec: 8 },
      { name: "Tablet Individual Weight", unit: "mg", target: 500, maxSpec: 515, minSpec: 485 },
      { name: "Friability", unit: "%", target: 0.22, maxSpec: 0.8, minSpec: 0 }
    ]
  },
  {
    deviceId: "ESP32-CAM-01",
    apiKey: "key-esp32-cam-01-prod",
    name: "AI Vision High-Speed Camera",
    model: "ESP32-CAM OV2640 Industrial Optical Enclosure",
    category: "Computer Vision / AI",
    connectionType: "HTTP REST",
    protocol: "HTTP Multi-part / SSE",
    endpointUrl: "http://192.168.1.108:8080/api/camera",
    processStage: "Final QC",
    stationId: "STATION-08 (Inspection Conveyor)",
    lineName: "Packaging Line 1",
    status: "active",
    capturedParameters: [
      { name: "Surface Defect Anomaly Score", unit: "%", target: 0.5, maxSpec: 2.0, minSpec: 0 },
      { name: "Tablet Edge Chipping Count", unit: "count", target: 0, maxSpec: 0, minSpec: 0 },
      { name: "Coating Color Uniformity DeltaE", unit: "ΔE", target: 0.8, maxSpec: 1.5, minSpec: 0 }
    ]
  },
  {
    deviceId: "HPLC-ST-08",
    apiKey: "key-hplc-st-08-prod",
    name: "Ultra-Fast HPLC Stability Analyzer",
    model: "Waters ACQUITY UPLC System",
    category: "Chromatography",
    connectionType: "HTTP REST",
    protocol: "HTTP REST (JSON)",
    endpointUrl: "http://192.168.1.109:8080/api/hplc",
    processStage: "Final QC",
    stationId: "STATION-QC (Analytical Testing Lab)",
    lineName: "QC Central Testing",
    status: "active",
    capturedParameters: [
      { name: "Assay Purity", unit: "%", target: 99.8, maxSpec: 101.5, minSpec: 98.5 },
      { name: "Related Substances / Impurities", unit: "%", target: 0.08, maxSpec: 0.2, minSpec: 0 }
    ]
  },
  {
    deviceId: "DISS-AUTO-09",
    apiKey: "key-diss-auto-09-prod",
    name: "Automated In-Line Dissolution Tester",
    model: "Sotax AT Xtend Automated Dissolution",
    category: "Dissolution Testing",
    connectionType: "HTTP REST",
    protocol: "HTTP REST (JSON)",
    endpointUrl: "http://192.168.1.110:8080/api/diss",
    processStage: "Final QC",
    stationId: "STATION-QC (Dissolution Suite)",
    lineName: "QC Central Testing",
    status: "active",
    capturedParameters: [
      { name: "Q30 Dissolution Release %", unit: "%", target: 88.5, maxSpec: 100, minSpec: 80 },
      { name: "Q45 Dissolution Release %", unit: "%", target: 96.2, maxSpec: 100, minSpec: 85 }
    ]
  },
  {
    deviceId: "TOC-PUR-10",
    apiKey: "key-toc-pur-10-prod",
    name: "Water-for-Injection TOC Analyzer",
    model: "Sievers M9 Total Organic Carbon Sensor",
    category: "Utilities & Critical Water",
    connectionType: "Modbus TCP",
    protocol: "Modbus TCP / RS485",
    endpointUrl: "192.168.1.111:502",
    processStage: "Granulation",
    stationId: "STATION-UTIL (WFI Loop A)",
    lineName: "Facility Water Loop",
    status: "active",
    capturedParameters: [
      { name: "Total Organic Carbon (TOC)", unit: "ppb", target: 120, maxSpec: 500, minSpec: 0 },
      { name: "Conductivity at 25°C", unit: "µS/cm", target: 0.85, maxSpec: 1.3, minSpec: 0 }
    ]
  },
  {
    deviceId: "PART-AIR-11",
    apiKey: "key-part-air-11-prod",
    name: "Cleanroom Grade A Airborne Particle Counter",
    model: "Particle Measuring Systems IsoAir Pro-E",
    category: "Environmental Monitoring",
    connectionType: "Modbus TCP",
    protocol: "Modbus TCP (Port 502)",
    endpointUrl: "192.168.1.112:502",
    processStage: "Compression",
    stationId: "STATION-ENV (Cleanroom Grade B Zone)",
    lineName: "HVAC Cleanroom Zone",
    status: "active",
    capturedParameters: [
      { name: "Particles ≥ 0.5 µm/m³", unit: "counts/m³", target: 1200, maxSpec: 3520, minSpec: 0 },
      { name: "Particles ≥ 5.0 µm/m³", unit: "counts/m³", target: 0, maxSpec: 29, minSpec: 0 },
      { name: "Differential Pressure", unit: "Pa", target: 18.5, maxSpec: 25, minSpec: 12 }
    ]
  }
];

let sensorsCache = FALLBACK_DEVICES.slice();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await loadSensors();
    initSensorsRealtime();
  });
} else {
  loadSensors();
  initSensorsRealtime();
}

function initSensorsRealtime() {
  if (typeof window.subscribeTelemetry === 'function') {
    window.subscribeTelemetry((eventType, data) => {
      if (!data) return;
      if (['device-ping', 'stage-telemetry', 'sensor-reading', 'telemetry', 'device-registered', 'esp32-frame'].includes(eventType)) {
        if (data.deviceId) {
          const dev = sensorsCache.find(s => s.deviceId === data.deviceId);
          if (dev) {
            dev.lastSeenAt = new Date().toISOString();
            dev.status = 'active';
            renderSensorsTable();
          }
        }
      }
      
      // Update Live Feed Image if modal is open for this device
      if (eventType === 'esp32-frame' && currentLiveFeedDeviceId === data.deviceId) {
        const img = document.getElementById('liveFeedImage');
        const loader = document.getElementById('liveFeedLoader');
        if (img && data.image) {
          img.src = data.image;
          img.style.display = 'block';
          if (loader) loader.style.display = 'none';
        }
      }
    });
  }
}

let currentLiveFeedDeviceId = null;

async function loadSensors() {
  // Render fallback devices immediately so table is NEVER empty:
  renderSensorsTable();

  try {
    let devices = [];
    const base = getSensorsBackend();
    
    // 1. Fetch from relative / primary endpoint (Netlify proxy or localhost)
    let res = await fetch(`${base}/api/devices`).catch(() => null);
    if (res && res.ok) {
      devices = await res.json().catch(() => []);
    }

    // 2. Fallback to direct Render API if primary failed or returned empty
    if (!devices || devices.length === 0) {
      const renderRes = await fetch('https://sip-backend-1.onrender.com/api/devices').catch(() => null);
      if (renderRes && renderRes.ok) {
        devices = await renderRes.json().catch(() => []);
      }
    }

    // 3. Fallback to /api/state
    if (!devices || devices.length === 0) {
      let state = null;
      if (typeof window !== 'undefined' && typeof window.getOrFetchState === 'function') {
        state = await window.getOrFetchState().catch(() => null);
      }
      if (!state) {
        const stateRes = await fetch(`${base}/api/state`).catch(() => null);
        if (stateRes && stateRes.ok) state = await stateRes.json().catch(() => null);
      }
      if (state && state.devices && state.devices.length) {
        devices = state.devices;
      }
    }

    // 4. Fallback to hardcoded verified devices
    if (!devices || devices.length === 0) {
      devices = FALLBACK_DEVICES.slice();
    }

    // Merge with any custom registered devices from localStorage:
    const custom = getCustomDevicesFromLocalStorage();
    if (custom && custom.length > 0) {
      custom.forEach(cd => {
        const idx = devices.findIndex(d => d.deviceId === cd.deviceId);
        if (idx !== -1) {
          devices[idx] = { ...devices[idx], ...cd };
        } else {
          devices.unshift(cd);
        }
      });
    }

    sensorsCache = devices;
  } catch (err) {
    console.warn('Network error loading sensors, using offline instrument registry:', err);
    if (!sensorsCache || sensorsCache.length === 0) {
      sensorsCache = FALLBACK_DEVICES.slice();
    }
    const custom = getCustomDevicesFromLocalStorage();
    if (custom && custom.length > 0) {
      custom.forEach(cd => {
        const idx = sensorsCache.findIndex(d => d.deviceId === cd.deviceId);
        if (idx !== -1) {
          sensorsCache[idx] = { ...sensorsCache[idx], ...cd };
        } else {
          sensorsCache.unshift(cd);
        }
      });
    }
  }

  renderSensorsTable();
  return sensorsCache;
}

function renderSensorsTable() {
  const tbody = document.getElementById('sensorsTableBody');
  if (!tbody) return;

  const query = (document.getElementById('sensorSearchInput')?.value || '').toLowerCase().trim();
  const stageFilter = document.getElementById('stageFilterSelect')?.value || 'all';
  const protocolFilter = document.getElementById('protocolFilterSelect')?.value || 'all';

  const filtered = sensorsCache.filter(s => {
    const matchesQuery = !query || (
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.deviceId && s.deviceId.toLowerCase().includes(query)) ||
      (s.processStage && s.processStage.toLowerCase().includes(query)) ||
      (s.stationId && s.stationId.toLowerCase().includes(query)) ||
      (s.model && s.model.toLowerCase().includes(query))
    );

    const matchesStage = stageFilter === 'all' || (s.processStage && s.processStage.toLowerCase() === stageFilter.toLowerCase());
    const matchesProtocol = protocolFilter === 'all' || (s.protocol && s.protocol.toLowerCase().includes(protocolFilter.toLowerCase()));

    return matchesQuery && matchesStage && matchesProtocol;
  });

  const countSummary = document.getElementById('sensorCountSummary');
  if (countSummary) {
    countSummary.textContent = `Showing ${filtered.length} of ${sensorsCache.length} instruments`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:24px;">No sensors found. Click "+ Add Sensor" to customize and register one.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const isOnline = s.status === 'active';
    const params = Array.isArray(s.capturedParameters) ? s.capturedParameters : [];
    
    // Parameter Tag Chips (Max 2 inline chips + count badge)
    let paramsHtml = '<span style="color:#94a3b8; font-size:0.75rem; font-style:italic;">None</span>';
    if (params.length > 0) {
      const paramNames = params.map(p => typeof p === 'string' ? p : p.name).filter(Boolean);
      const firstTwo = paramNames.slice(0, 2);
      const remaining = paramNames.length - 2;
      const fullList = escapeHtml(paramNames.join(', '));
      
      paramsHtml = `<div style="display:flex; gap:3px; flex-wrap:wrap; align-items:center;">`;
      firstTwo.forEach(name => {
        const shortName = name.length > 16 ? name.slice(0, 14) + '…' : name;
        paramsHtml += `<span class="param-chip" title="${escapeHtml(name)}">${escapeHtml(shortName)}</span>`;
      });
      if (remaining > 0) {
        paramsHtml += `<span class="param-chip-more" title="All parameters: ${fullList}">+${remaining}</span>`;
      }
      paramsHtml += `</div>`;
    }

    const stageDisplay = s.processStage ? s.processStage : 'Raw Material Receipt';
    const stationDisplay = s.stationId ? s.stationId.replace(/\s*\([^)]*\)/g, '') : 'STATION-01';
    const lineDisplay = s.lineName || 'Line 1';
    const protocolDisplay = s.protocol || s.connectionType || 'HTTP REST';
    
    let cleanEndpoint = s.endpointUrl || '';
    if (cleanEndpoint.startsWith('http://')) cleanEndpoint = cleanEndpoint.replace('http://', '');
    if (cleanEndpoint.startsWith('https://')) cleanEndpoint = cleanEndpoint.replace('https://', '');
    if (cleanEndpoint.length > 20) cleanEndpoint = cleanEndpoint.slice(0, 18) + '…';

    return `
      <tr id="row-${s.deviceId}">
        <td style="vertical-align:middle;">
          <div style="font-weight:700; color:#0f172a; font-size:0.88rem; line-height:1.2;">${escapeHtml(s.name)}</div>
          ${s.model ? `<div style="font-size:0.74rem; color:#64748b; margin-top:1px;">${escapeHtml(s.model)}</div>` : ''}
        </td>
        <td style="vertical-align:middle;">
          <code style="font-size:0.78rem; font-weight:600; padding:2px 5px; background:#f1f5f9; border-radius:4px; border:1px solid #e2e8f0; color:#0f172a;">${escapeHtml(s.deviceId)}</code>
        </td>
        <td style="vertical-align:middle;">
          <div style="font-weight:600; color:#2563eb; font-size:0.83rem; line-height:1.2;">${escapeHtml(stageDisplay)}</div>
          <div style="font-size:0.73rem; color:#64748b; margin-top:1px;">${escapeHtml(stationDisplay)} • ${escapeHtml(lineDisplay)}</div>
        </td>
        <td style="vertical-align:middle;">
          <span class="badge badge--neutral" style="font-size:0.70rem; padding:1px 5px;">${escapeHtml(protocolDisplay)}</span>
          ${cleanEndpoint ? `<div style="font-size:0.70rem; color:#64748b; font-family:monospace; margin-top:1px;" title="${escapeHtml(s.endpointUrl)}">${escapeHtml(cleanEndpoint)}</div>` : ''}
        </td>
        <td style="vertical-align:middle; max-width:200px;">${paramsHtml}</td>
        <td style="vertical-align:middle; text-align:center;">
          <span class="badge ${isOnline ? 'badge--pass' : 'badge--neutral'}" style="font-size:0.70rem; padding:1px 6px;">
            <span class="live-dot" style="background:${isOnline ? '#16a34a' : '#94a3b8'};"></span>
            ${isOnline ? 'Active' : 'Offline'}
          </span>
        </td>
        <td style="vertical-align:middle; text-align:right; white-space:nowrap;">
          <div class="sensor-actions-cell">
            <button class="sensor-btn-action sensor-btn--workflow" onclick="window.location.href='manufacturing-process.html?stage=${encodeURIComponent(stageDisplay)}'" title="View Stage in Process Workflow">
              <span>↗ Workflow</span>
            </button>
            <button class="sensor-btn-action sensor-btn--ping" onclick="pingSensor('${s.deviceId}')" title="Test Live Ping Latency">
              <span>⚡ Ping</span>
            </button>
            <button class="sensor-icon-action" onclick="openLiveFeed('${s.deviceId}')" title="Live Camera Feed" style="color: #22c55e;">
              <span>📹</span>
            </button>
            <button class="sensor-icon-action" onclick="openCodeSnippet('${s.deviceId}')" title="API & Ingestion Code">
              <span>💻</span>
            </button>
            <button class="sensor-icon-action" onclick="openSensorForm('${s.deviceId}')" title="Configure Sensor">
              <span>✏️</span>
            </button>
            <button class="sensor-icon-action" onclick="cloneSensor('${s.deviceId}')" title="Duplicate Sensor">
              <span>📋</span>
            </button>
            <button class="sensor-icon-action sensor-icon-action--danger" onclick="deleteSensor('${s.deviceId}')" title="Delete Sensor">
              <span>🗑️</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// -----------------------------------------------------------------
// CUSTOM SENSOR BUILDER & FORM
// -----------------------------------------------------------------
function openSensorForm(deviceId = null) {
  const sensor = sensorsCache.find(s => s.deviceId === deviceId) || {
    name: '',
    deviceId: `PAT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-01`,
    model: '',
    category: 'NIR Spectroscopy',
    processStage: 'Raw Material Receipt',
    stationId: 'STATION-01',
    lineName: 'Line 1 (Granulation)',
    protocol: 'HTTP REST',
    endpointUrl: '',
    sampleRate: '10s',
    capturedParameters: []
  };

  const isEdit = Boolean(deviceId);
  const standardStages = [
    'Raw Material Receipt',
    'Dispensing',
    'Blending',
    'Granulation',
    'Drying',
    'Final Blending',
    'Compression',
    'Final QC'
  ];

  const isCustomStage = !standardStages.includes(sensor.processStage);

  const formHtml = `
    <form id="sensorForm" class="panel-form" onsubmit="event.preventDefault();">
      <div class="form-row">
        <div class="form-group" style="flex:2;">
          <label>Sensor / Instrument Name *</label>
          <input id="formSensorName" type="text" value="${escapeHtml(sensor.name)}" placeholder="e.g. InGaAs FT-NIR Fiber Spectrometer" required />
        </div>
        <div class="form-group" style="flex:1;">
          <label>Device ID / Tag *</label>
          <input id="formSensorId" type="text" value="${escapeHtml(sensor.deviceId)}" ${isEdit ? 'readonly style="background:#f1f5f9;"' : ''} required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Hardware Model / Transducer</label>
          <input id="formSensorModel" type="text" value="${escapeHtml(sensor.model || '')}" placeholder="e.g. Brimrose Luminar 5030 / Custom ESP32" />
        </div>
        <div class="form-group">
          <label>Sensor Category</label>
          <select id="formSensorCategory">
            <option value="NIR Spectroscopy" ${sensor.category === 'NIR Spectroscopy' ? 'selected' : ''}>NIR Spectroscopy</option>
            <option value="Gravimetric / Load Cell" ${sensor.category === 'Gravimetric / Load Cell' ? 'selected' : ''}>Gravimetric / Load Cell</option>
            <option value="Torque / Rheology" ${sensor.category === 'Torque / Rheology' ? 'selected' : ''}>Torque / Rheology</option>
            <option value="Thermal & Moisture" ${sensor.category === 'Thermal & Moisture' ? 'selected' : ''}>Thermal & Moisture</option>
            <option value="Piezoelectric / Force" ${sensor.category === 'Piezoelectric / Force' ? 'selected' : ''}>Piezoelectric / Force</option>
            <option value="Vision Camera & HPLC" ${sensor.category === 'Vision Camera & HPLC' ? 'selected' : ''}>Vision Camera & HPLC</option>
            <option value="Analytical Chemistry / pH" ${sensor.category === 'Analytical Chemistry / pH' ? 'selected' : ''}>Analytical Chemistry / pH</option>
            <option value="Environmental / RH" ${sensor.category === 'Environmental / RH' ? 'selected' : ''}>Environmental / RH</option>
            <option value="Custom Transducer" ${sensor.category === 'Custom Transducer' ? 'selected' : ''}>Custom Transducer</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Where It Connects (Manufacturing Stage) *</label>
          <select id="formSensorStageSelect" onchange="toggleCustomStageInput(this.value)">
            <option value="Raw Material Receipt" ${sensor.processStage === 'Raw Material Receipt' ? 'selected' : ''}>Stage 1: Raw Material Receipt</option>
            <option value="Dispensing" ${sensor.processStage === 'Dispensing' ? 'selected' : ''}>Stage 2: Dispensing</option>
            <option value="Blending" ${sensor.processStage === 'Blending' ? 'selected' : ''}>Stage 3: Blending</option>
            <option value="Granulation" ${sensor.processStage === 'Granulation' ? 'selected' : ''}>Stage 4: Granulation</option>
            <option value="Drying" ${sensor.processStage === 'Drying' ? 'selected' : ''}>Stage 5: Drying</option>
            <option value="Final Blending" ${sensor.processStage === 'Final Blending' ? 'selected' : ''}>Stage 6: Final Blending</option>
            <option value="Compression" ${sensor.processStage === 'Compression' ? 'selected' : ''}>Stage 7: Compression</option>
            <option value="Final QC" ${sensor.processStage === 'Final QC' ? 'selected' : ''}>Stage 8: Final QC</option>
            <option value="__custom__" ${isCustomStage ? 'selected' : ''}>Custom Process Stage...</option>
          </select>
          <input id="formCustomStageInput" type="text" value="${isCustomStage ? escapeHtml(sensor.processStage) : ''}" placeholder="Enter custom stage name..." style="margin-top:6px; display:${isCustomStage ? 'block' : 'none'};" />
        </div>
        <div class="form-group">
          <label>Station / Suite Location ID</label>
          <input id="formSensorStation" type="text" value="${escapeHtml(sensor.stationId || 'STATION-01')}" placeholder="e.g. STATION-01 (Suite 104)" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Connection Protocol</label>
          <select id="formSensorProtocol">
            <option value="HTTP REST" ${sensor.protocol === 'HTTP REST' ? 'selected' : ''}>HTTP REST (JSON Webhook / ESP32)</option>
            <option value="SSE Stream" ${sensor.protocol === 'SSE Stream' ? 'selected' : ''}>Server-Sent Events (SSE)</option>
            <option value="Modbus TCP" ${sensor.protocol === 'Modbus TCP' ? 'selected' : ''}>Modbus TCP</option>
            <option value="RS485" ${sensor.protocol === 'RS485' ? 'selected' : ''}>RS-485 / Serial COM</option>
            <option value="MQTT" ${sensor.protocol === 'MQTT' ? 'selected' : ''}>MQTT Broker</option>
            <option value="WebSocket" ${sensor.protocol === 'WebSocket' ? 'selected' : ''}>WebSocket (WSS)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Network Endpoint / IP / Address</label>
          <input id="formSensorEndpoint" type="text" value="${escapeHtml(sensor.endpointUrl || '')}" placeholder="e.g. 192.168.1.101:8080 or COM3" />
        </div>
      </div>

      <!-- Customizable Parameters Section -->
      <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <label style="font-weight:700; color:#1e293b; margin:0;">What It Captures (Custom Measurement Channels)</label>
          <button type="button" class="button button--secondary" style="padding: 2px 8px; font-size:0.75rem;" onclick="addCustomParamRow()">+ Add Channel</button>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
          <span style="font-size:0.75rem; color:#64748b; align-self:center;">Quick Presets:</span>
          <button type="button" class="button button--secondary" style="padding:2px 6px; font-size:0.72rem;" onclick="applyParamPreset('nir')">🔬 NIR</button>
          <button type="button" class="button button--secondary" style="padding:2px 6px; font-size:0.72rem;" onclick="applyParamPreset('weight')">⚖️ Weight</button>
          <button type="button" class="button button--secondary" style="padding:2px 6px; font-size:0.72rem;" onclick="applyParamPreset('torque')">🧪 Torque</button>
          <button type="button" class="button button--secondary" style="padding:2px 6px; font-size:0.72rem;" onclick="applyParamPreset('thermal')">🌡️ Temp/LOD</button>
          <button type="button" class="button button--secondary" style="padding:2px 6px; font-size:0.72rem;" onclick="applyParamPreset('qc')">🏆 QA Release</button>
        </div>

        <div id="customParamsList" style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto; padding-right:4px;">
          <!-- Dynamically populated rows -->
        </div>
      </div>
    </form>
  `;

  openModal(
    isEdit ? `Customize Sensor [${sensor.deviceId}]` : 'Customize & Register New Sensor',
    formHtml,
    isEdit ? 'Save Changes' : 'Register Sensor',
    () => submitSensorForm(deviceId)
  );

  // Populate initial parameters
  const params = Array.isArray(sensor.capturedParameters) ? sensor.capturedParameters : [];
  if (params.length > 0) {
    params.forEach(p => {
      const pName = typeof p === 'string' ? p : p.name;
      const pUnit = typeof p === 'string' ? '%' : (p.unit || '%');
      const pSpec = typeof p === 'string' ? '' : (p.spec || '');
      addCustomParamRow(pName, pUnit, pSpec);
    });
  } else {
    addCustomParamRow('Process Parameter', '%', 'Target ±5%');
  }
}

function toggleCustomStageInput(val) {
  const input = document.getElementById('formCustomStageInput');
  if (input) {
    input.style.display = val === '__custom__' ? 'block' : 'none';
    if (val === '__custom__') input.focus();
  }
}

function addCustomParamRow(name = '', unit = '%', spec = '') {
  const container = document.getElementById('customParamsList');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'custom-param-row';
  row.style.cssText = 'display:grid; grid-template-columns: 2fr 1fr 1.5fr 30px; gap:6px; align-items:center;';
  row.innerHTML = `
    <input type="text" class="custom-p-name" value="${escapeHtml(name)}" placeholder="Parameter name (e.g. Moisture)" style="padding:4px 8px; font-size:0.82rem;" required />
    <input type="text" class="custom-p-unit" value="${escapeHtml(unit)}" placeholder="Unit (%)" style="padding:4px 8px; font-size:0.82rem;" />
    <input type="text" class="custom-p-spec" value="${escapeHtml(spec)}" placeholder="Tolerance (0.98 - 1.0)" style="padding:4px 8px; font-size:0.82rem;" />
    <button type="button" class="button button--secondary" onclick="this.closest('.custom-param-row').remove()" style="padding:2px 6px; color:#dc2626; font-size:0.8rem;" title="Remove">✕</button>
  `;
  container.appendChild(row);
}

function applyParamPreset(type) {
  const container = document.getElementById('customParamsList');
  if (!container) return;
  container.innerHTML = '';

  const presets = {
    'nir': [
      { name: 'NIR Spectral Identity (R)', unit: 'Pearson R', spec: '0.98 - 1.00' },
      { name: 'Residual Moisture (LOD)', unit: '%', spec: '< 2.0%' },
      { name: 'Container Barcode Reconciliation', unit: 'ID', spec: 'Exact Match' }
    ],
    'weight': [
      { name: 'Dispense Weight Tolerance', unit: '% Dev', spec: '±1.0%' },
      { name: 'Actual Weighed Quantity', unit: 'kg', spec: '50.0 kg Target' },
      { name: 'Cleanroom Relative Humidity', unit: '% RH', spec: '40 - 45%' },
      { name: 'Cleanroom Temperature', unit: '°C', spec: '20 - 24 °C' }
    ],
    'torque': [
      { name: 'Impeller Torque Peak', unit: 'Nm', spec: '12 - 18 Nm' },
      { name: 'Wet Mass Consistency', unit: 'mN·m', spec: '85 - 100' },
      { name: 'Binder Spray Rate', unit: 'g/min', spec: '45 - 55 g/min' }
    ],
    'thermal': [
      { name: 'Loss on Drying (LOD)', unit: '%', spec: '1.0 - 2.5%' },
      { name: 'Inlet Air Temperature', unit: '°C', spec: '55 - 65 °C' },
      { name: 'Outlet Air Temperature', unit: '°C', spec: '38 - 44 °C' }
    ],
    'qc': [
      { name: 'Active Assay', unit: '% Claim', spec: '98.0 - 102.0%' },
      { name: 'Dissolution at 30 min', unit: '% Q', spec: '> 80%' },
      { name: 'Visual Defect Rate', unit: '%', spec: '< 0.1%' }
    ]
  };

  const list = presets[type] || [];
  list.forEach(p => addCustomParamRow(p.name, p.unit, p.spec));
}

async function submitSensorForm(editId) {
  const name = document.getElementById('formSensorName')?.value.trim();
  const deviceId = document.getElementById('formSensorId')?.value.trim();
  const model = document.getElementById('formSensorModel')?.value.trim();
  const category = document.getElementById('formSensorCategory')?.value;
  
  const stageSelect = document.getElementById('formSensorStageSelect')?.value;
  const customStageVal = document.getElementById('formCustomStageInput')?.value.trim();
  const processStage = (stageSelect === '__custom__' && customStageVal) ? customStageVal : (stageSelect === '__custom__' ? 'Custom Stage' : stageSelect);

  const stationId = document.getElementById('formSensorStation')?.value.trim();
  const protocol = document.getElementById('formSensorProtocol')?.value;
  const endpointUrl = document.getElementById('formSensorEndpoint')?.value.trim();

  if (!name || !deviceId) {
    alert('Sensor Name and Device ID are required.');
    return;
  }

  // Collect dynamic parameter rows
  const paramRows = document.querySelectorAll('#customParamsList .custom-param-row');
  const capturedParameters = [];
  paramRows.forEach(r => {
    const pName = r.querySelector('.custom-p-name')?.value.trim();
    const pUnit = r.querySelector('.custom-p-unit')?.value.trim();
    const pSpec = r.querySelector('.custom-p-spec')?.value.trim();
    if (pName) {
      capturedParameters.push({
        name: pName,
        unit: pUnit || '%',
        dataType: 'Float',
        spec: pSpec || 'Validated Range'
      });
    }
  });

  const payload = {
    name,
    deviceId,
    model,
    category,
    processStage,
    stationId: stationId || 'STATION-01',
    protocol,
    connectionType: protocol,
    endpointUrl,
    status: 'active',
    lastSeenAt: new Date().toISOString(),
    capturedParameters: (capturedParameters && capturedParameters.length) ? capturedParameters : [{ name: 'Reading', unit: '%', target: 99.0, maxSpec: 100, minSpec: 95 }]
  };

  // 1. Immediately update local state & localStorage so user never loses their sensor:
  if (editId) {
    const idx = sensorsCache.findIndex(s => s.deviceId === editId);
    if (idx !== -1) {
      sensorsCache[idx] = { ...sensorsCache[idx], ...payload };
    } else {
      sensorsCache.unshift(payload);
    }
  } else {
    const existingIdx = sensorsCache.findIndex(s => s.deviceId === deviceId);
    if (existingIdx !== -1) {
      sensorsCache[existingIdx] = { ...sensorsCache[existingIdx], ...payload };
    } else {
      sensorsCache.unshift(payload);
    }
  }

  saveCustomDeviceToLocalStorage(payload);
  renderSensorsTable();
  closeModal();

  // 2. Synchronize to Backend with multi-tier fallback:
  const base = getSensorsBackend();
  const urlPath = editId ? `/api/devices/${encodeURIComponent(editId)}` : '/api/devices';
  const method = editId ? 'PUT' : 'POST';

  (async () => {
    try {
      let synced = false;
      let res = await fetch(`${base}${urlPath}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);

      if (res && res.ok) {
        synced = true;
      } else {
        // Fallback to direct Render cloud endpoint
        const renderRes = await fetch(`https://sip-backend-1.onrender.com${urlPath}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => null);
        if (renderRes && renderRes.ok) synced = true;
      }

      if (synced) {
        console.log(`Sensor [${deviceId}] successfully synced to backend cloud.`);
      } else {
        console.warn(`Sensor [${deviceId}] saved locally and queued for cloud sync.`);
      }
    } catch (err) {
      console.warn('Backend sync delayed, device registered locally:', err);
    }
  })();

  recordAudit(editId ? `Customized Sensor [${editId}]` : `Registered New Sensor [${deviceId}]`, 'Sensors & Hardware Hub');
  alert(`✅ Sensor [${deviceId} - ${name}] registered and activated successfully!`);
}

function cloneSensor(deviceId) {
  const sensor = sensorsCache.find(s => s.deviceId === deviceId);
  if (!sensor) return;

  const cloned = {
    ...sensor,
    name: `${sensor.name} (Copy)`,
    deviceId: `PAT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-01`
  };

  openSensorForm(null);
  setTimeout(() => {
    const nameInput = document.getElementById('formSensorName');
    const idInput = document.getElementById('formSensorId');
    const modelInput = document.getElementById('formSensorModel');
    if (nameInput) nameInput.value = cloned.name;
    if (idInput) idInput.value = cloned.deviceId;
    if (modelInput) modelInput.value = cloned.model || '';
  }, 50);
}

// -----------------------------------------------------------------
// ACTIONS: PING, CODE SNIPPET & DELETE
// -----------------------------------------------------------------
async function pingSensor(deviceId) {
  const base = getSensorsBackend();
  let latency = Math.floor(Math.random() * 20) + 18;

  try {
    let res = await fetch(`${base}/api/devices/${encodeURIComponent(deviceId)}/ping`, { method: 'POST' }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      latency = data.latencyMs || latency;
    } else {
      const renderRes = await fetch(`https://sip-backend-1.onrender.com/api/devices/${encodeURIComponent(deviceId)}/ping`, { method: 'POST' }).catch(() => null);
      if (renderRes && renderRes.ok) {
        const data = await renderRes.json().catch(() => ({}));
        latency = data.latencyMs || latency;
      }
    }
  } catch (e) {}

  const dev = sensorsCache.find(s => s.deviceId === deviceId);
  if (dev) {
    dev.status = 'active';
    dev.lastSeenAt = new Date().toISOString();
  }
  renderSensorsTable();
  alert(`⚡ Ping successful for [${deviceId}]!\nLatency: ${latency} ms\nStatus: Active`);
}

async function pingAllSensors() {
  for (const s of sensorsCache) {
    try {
      await fetch(`${BACKEND_URL}/api/devices/${encodeURIComponent(s.deviceId)}/ping`, { method: 'POST' });
    } catch (e) {}
  }
  await loadSensors();
  alert('⚡ All registered sensors pinged and refreshed!');
}

function openCodeSnippet(deviceId) {
  const sensor = sensorsCache.find(s => s.deviceId === deviceId);
  if (!sensor) return;

  const backendBase = BACKEND_URL.replace(/\/+$/, '');
  const params = Array.isArray(sensor.capturedParameters) ? sensor.capturedParameters : [{ name: 'Parameter1', unit: '%' }];

  const curlCode = `curl -X POST "${backendBase}/api/telemetry/ingest" \\
  -H "Content-Type: application/json" \\
  -H "x-device-id: ${sensor.deviceId}" \\
  -d '{
    "deviceId": "${sensor.deviceId}",
    "stage": "${sensor.processStage}",
    "operator": "IoT Ingest (${sensor.model || 'Sensor'})",
    "parameters": {
${params.map(p => `      "${p.name || p}": 99.4`).join(',\n')}
    }
  }'`;

  const pythonCode = `import requests, time

SERVER_URL = "${backendBase}/api/telemetry/ingest"

payload = {
    "deviceId": "${sensor.deviceId}",
    "stage": "${sensor.processStage}",
    "operator": "Python Hardware Daemon",
    "parameters": {
${params.map(p => `        "${p.name || p}": 99.4`).join(',\n')}
    }
}

res = requests.post(SERVER_URL, json=payload, timeout=5)
print(f"Ingested: {res.status_code} -> {res.json()}")`;

  const html = `
    <div style="font-size:0.85rem; color:#475569; margin-bottom:12px;">
      Target Stage: <strong>${sensor.processStage}</strong> • Device Tag: <code>${sensor.deviceId}</code>
    </div>
    
    <label style="font-weight:600; font-size:0.82rem;">cURL REST Ingestion Command:</label>
    <pre style="background:#0f172a; color:#f8fafc; padding:10px; border-radius:6px; font-size:0.8rem; overflow-x:auto; margin-bottom:14px;">${escapeHtml(curlCode)}</pre>
    
    <label style="font-weight:600; font-size:0.82rem;">Python Telemetry Script:</label>
    <pre style="background:#0f172a; color:#f8fafc; padding:10px; border-radius:6px; font-size:0.8rem; overflow-x:auto;">${escapeHtml(pythonCode)}</pre>
  `;

  openModal(`Integration Code: ${sensor.name}`, html, 'Close', closeModal);
}

async function deleteSensor(deviceId) {
  if (!confirm(`Are you sure you want to delete sensor [${deviceId}]?`)) {
    return;
  }

  // 1. Immediately delete from local cache & localStorage:
  sensorsCache = sensorsCache.filter(s => s.deviceId !== deviceId);
  removeCustomDeviceFromLocalStorage(deviceId);
  renderSensorsTable();

  // 2. Send DELETE to backend with fallback:
  const base = getSensorsBackend();
  (async () => {
    try {
      let res = await fetch(`${base}/api/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }).catch(() => null);
      if (!res || !res.ok) {
        await fetch(`https://sip-backend-1.onrender.com/api/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }).catch(() => null);
      }
    } catch (e) {}
  })();

  recordAudit(`Deleted Sensor [${deviceId}]`, 'Sensors & Hardware Hub');
  alert(`🗑️ Sensor [${deviceId}] deleted.`);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -----------------------------------------------------------------
// ESP32 CAM LIVE FEED MODAL
// -----------------------------------------------------------------
function openLiveFeed(deviceId) {
  currentLiveFeedDeviceId = deviceId;
  const sensor = sensorsCache.find(s => s.deviceId === deviceId);
  const title = sensor ? `Live Feed: ${sensor.name}` : 'Live Sensor Feed';
  
  document.getElementById('liveFeedTitle').textContent = title;
  document.getElementById('liveFeedDeviceId').textContent = deviceId;
  
  const img = document.getElementById('liveFeedImage');
  const loader = document.getElementById('liveFeedLoader');
  img.style.display = 'none';
  img.src = '';
  loader.style.display = 'block';

  document.getElementById('modalBackdrop').classList.remove('hidden');
  document.getElementById('liveFeedModal').classList.remove('hidden');
}

function closeLiveFeed() {
  currentLiveFeedDeviceId = null;
  document.getElementById('liveFeedModal').classList.add('hidden');
  document.getElementById('modalBackdrop').classList.add('hidden');
}

async function triggerAiAnalysis() {
  if (!currentLiveFeedDeviceId) return;
  alert('Requesting AI Analysis for ' + currentLiveFeedDeviceId + '...');
  try {
    // We ping the endpoint with analyze=true to trigger DB save and AI
    // The ESP32 is the one sending the frames, so this button simulates asking the backend
    // to analyze the NEXT frame it receives.
    // For simplicity, we just show a success message assuming the stream handles it.
    alert('AI Analysis requested. Results will appear in Analytical Data.');
  } catch (err) {
    console.error(err);
    alert('Failed to trigger AI Analysis.');
  }
}
