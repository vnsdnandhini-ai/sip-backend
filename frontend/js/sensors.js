/**
 * sensors.js
 * Clean, generic line-by-line Sensors Management Controller
 * Matches the platform standard table & modal design.
 */

var BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : 'http://localhost:3000';
if (typeof window !== 'undefined') {
  window.BACKEND_URL = BACKEND_URL;
}

let sensorsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadSensors();
  initSensorsRealtime();
});

function initSensorsRealtime() {
  if (typeof window.subscribeTelemetry === 'function') {
    window.subscribeTelemetry((eventType, data) => {
      if (!data) return;
      if (['device-ping', 'stage-telemetry', 'sensor-reading', 'telemetry', 'device-registered'].includes(eventType)) {
        if (data.deviceId) {
          const dev = sensorsCache.find(s => s.deviceId === data.deviceId);
          if (dev) {
            dev.lastSeenAt = new Date().toISOString();
            dev.status = 'active';
            renderSensorsTable();
          }
        }
      }
    });
  }
}

async function loadSensors() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/devices`);
    if (res.ok) {
      sensorsCache = await res.json();
    } else {
      const stateRes = await fetch(`${BACKEND_URL}/api/state`);
      const state = await stateRes.json();
      sensorsCache = state.devices || [];
    }
  } catch (err) {
    console.error('Failed to load sensors:', err);
    sensorsCache = [];
  }
  renderSensorsTable();
  return sensorsCache;
}

function renderSensorsTable() {
  const tbody = document.getElementById('sensorsTableBody');
  if (!tbody) return;

  const query = (document.getElementById('sensorSearchInput')?.value || '').toLowerCase().trim();
  const filtered = sensorsCache.filter(s => {
    if (!query) return true;
    return (
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.deviceId && s.deviceId.toLowerCase().includes(query)) ||
      (s.processStage && s.processStage.toLowerCase().includes(query)) ||
      (s.stationId && s.stationId.toLowerCase().includes(query)) ||
      (s.model && s.model.toLowerCase().includes(query))
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:24px;">No sensors found. Click "+ Add Sensor" to register one.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const isOnline = s.status === 'active';
    const params = Array.isArray(s.capturedParameters) ? s.capturedParameters : [];
    const paramsSummary = params.length > 0 
      ? params.map(p => typeof p === 'string' ? p : `${p.name} (${p.unit || ''})`).join(', ')
      : '<span style="color:#94a3b8;">Not configured</span>';

    const stageDisplay = s.processStage ? s.processStage : 'Raw Material Receipt';
    const stationDisplay = s.stationId ? s.stationId : 'STATION-01';
    const protocolDisplay = s.protocol || s.connectionType || 'HTTP REST';

    return `
      <tr id="row-${s.deviceId}">
        <td>
          <strong>${escapeHtml(s.name)}</strong>
          ${s.model ? `<div style="font-size:0.78rem; color:#64748b;">${escapeHtml(s.model)}</div>` : ''}
        </td>
        <td><code>${escapeHtml(s.deviceId)}</code></td>
        <td>
          <span style="font-weight:600; color:#2563eb;">${escapeHtml(stageDisplay)}</span>
          <div style="font-size:0.78rem; color:#64748b;">Station: ${escapeHtml(stationDisplay)} • ${escapeHtml(s.lineName || 'Line 1')}</div>
        </td>
        <td>
          <span class="badge badge--neutral">${escapeHtml(protocolDisplay)}</span>
          ${s.endpointUrl ? `<div style="font-size:0.75rem; color:#64748b; font-family:monospace;">${escapeHtml(s.endpointUrl)}</div>` : ''}
        </td>
        <td style="max-width:280px; font-size:0.85rem;">${paramsSummary}</td>
        <td>
          <span class="badge ${isOnline ? 'badge--pass' : 'badge--neutral'}">
            <span class="live-dot" style="background:${isOnline ? '#16a34a' : '#94a3b8'};"></span>
            ${isOnline ? 'Active' : 'Offline'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="table-action-button" onclick="pingSensor('${s.deviceId}')" title="Test Live Ping">Ping</button>
            <button class="table-action-button" onclick="openCodeSnippet('${s.deviceId}')" title="Integration Code">Code</button>
            <button class="table-action-button" onclick="openSensorForm('${s.deviceId}')" title="Edit Sensor">Edit</button>
            <button class="table-action-button danger" onclick="deleteSensor('${s.deviceId}')" title="Delete Sensor">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

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
  const paramsList = Array.isArray(sensor.capturedParameters) 
    ? sensor.capturedParameters.map(p => typeof p === 'string' ? p : `${p.name} (${p.unit || '%'})`).join(', ')
    : '';

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
          <input id="formSensorModel" type="text" value="${escapeHtml(sensor.model || '')}" placeholder="e.g. Brimrose Luminar 5030" />
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
            <option value="Environmental / RH" ${sensor.category === 'Environmental / RH' ? 'selected' : ''}>Environmental / RH</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Where It Connects (Manufacturing Stage) *</label>
          <select id="formSensorStage">
            <option value="Raw Material Receipt" ${sensor.processStage === 'Raw Material Receipt' ? 'selected' : ''}>Stage 1: Raw Material Receipt</option>
            <option value="Dispensing" ${sensor.processStage === 'Dispensing' ? 'selected' : ''}>Stage 2: Dispensing</option>
            <option value="Blending" ${sensor.processStage === 'Blending' ? 'selected' : ''}>Stage 3: Blending</option>
            <option value="Granulation" ${sensor.processStage === 'Granulation' ? 'selected' : ''}>Stage 4: Granulation</option>
            <option value="Drying" ${sensor.processStage === 'Drying' ? 'selected' : ''}>Stage 5: Drying</option>
            <option value="Final Blending" ${sensor.processStage === 'Final Blending' ? 'selected' : ''}>Stage 6: Final Blending</option>
            <option value="Compression" ${sensor.processStage === 'Compression' ? 'selected' : ''}>Stage 7: Compression</option>
            <option value="Final QC" ${sensor.processStage === 'Final QC' ? 'selected' : ''}>Stage 8: Final QC</option>
          </select>
        </div>
        <div class="form-group">
          <label>Station / Location ID</label>
          <input id="formSensorStation" type="text" value="${escapeHtml(sensor.stationId || 'STATION-01')}" placeholder="e.g. STATION-01 (Cleanroom A)" />
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
          </select>
        </div>
        <div class="form-group">
          <label>Network Endpoint / IP / COM Port</label>
          <input id="formSensorEndpoint" type="text" value="${escapeHtml(sensor.endpointUrl || '')}" placeholder="e.g. 192.168.1.101 or COM3" />
        </div>
      </div>

      <div class="form-group">
        <label>What It Captures (Comma-separated parameters)</label>
        <input id="formSensorParams" type="text" value="${escapeHtml(paramsList)}" placeholder="e.g. NIR Spectral Identity (Pearson R), Residual Moisture (%), Weight (kg)" />
        <span style="font-size:0.75rem; color:#64748b;">Enter parameter names and optional units in parentheses.</span>
      </div>
    </form>
  `;

  openModal(
    isEdit ? `Edit Sensor [${sensor.deviceId}]` : 'Register New Hardware Sensor',
    formHtml,
    isEdit ? 'Save Changes' : 'Register Sensor',
    () => submitSensorForm(deviceId)
  );
}

async function submitSensorForm(editId) {
  const name = document.getElementById('formSensorName')?.value.trim();
  const deviceId = document.getElementById('formSensorId')?.value.trim();
  const model = document.getElementById('formSensorModel')?.value.trim();
  const category = document.getElementById('formSensorCategory')?.value;
  const processStage = document.getElementById('formSensorStage')?.value;
  const stationId = document.getElementById('formSensorStation')?.value.trim();
  const protocol = document.getElementById('formSensorProtocol')?.value;
  const endpointUrl = document.getElementById('formSensorEndpoint')?.value.trim();
  const rawParams = document.getElementById('formSensorParams')?.value.trim();

  if (!name || !deviceId) {
    alert('Sensor Name and Device ID are required.');
    return;
  }

  // Parse comma separated parameter string
  const capturedParameters = rawParams ? rawParams.split(',').map(p => {
    const trimmed = p.trim();
    const match = trimmed.match(/^(.+?)\s*\((.*?)\)$/);
    if (match) {
      return { name: match[1].trim(), unit: match[2].trim(), dataType: 'Float' };
    }
    return { name: trimmed, unit: '%', dataType: 'Float' };
  }).filter(p => p.name) : [];

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
    capturedParameters
  };

  try {
    if (editId) {
      await fetch(`${BACKEND_URL}/api/devices/${encodeURIComponent(editId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      recordAudit(`Updated Sensor [${editId}]`, 'Sensors & Hardware Hub');
    } else {
      await fetch(`${BACKEND_URL}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      recordAudit(`Registered New Sensor [${deviceId}]`, 'Sensors & Hardware Hub');
    }

    closeModal();
    await loadSensors();
  } catch (err) {
    console.error('Failed to save sensor:', err);
    alert('Failed to save sensor. Check console.');
  }
}

async function pingSensor(deviceId) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/devices/${encodeURIComponent(deviceId)}/ping`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      alert(`⚡ Ping successful for [${deviceId}]!\nLatency: ${data.latencyMs} ms\nStatus: Active`);
      await loadSensors();
    } else {
      alert(`Ping failed for [${deviceId}]`);
    }
  } catch (e) {
    alert(`Connection error pinging [${deviceId}]`);
  }
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

  try {
    await fetch(`${BACKEND_URL}/api/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE'
    });
    recordAudit(`Deleted Sensor [${deviceId}]`, 'Sensors & Hardware Hub');
    await loadSensors();
  } catch (e) {
    console.error('Failed to delete sensor:', e);
    alert('Failed to delete. Check console.');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
