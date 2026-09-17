/**
 * sensors.js
 * Dedicated Sensors & Hardware Topology Hub Controller
 * Manages sensor registration, hardware topology mapping (Where It Connects),
 * telemetry channel definition (What It Captures), and live device diagnostics.
 */

var BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : 'http://localhost:3000';
if (typeof window !== 'undefined') {
  window.BACKEND_URL = BACKEND_URL;
}

let allSensors = [];
let currentFilterStage = 'all';
let currentFilterCategory = 'all';
let currentFilterProtocol = 'all';
let currentSearchQuery = '';
let activeSnippetDevice = null;
let activeSnippetTab = 'esp32';

// -----------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadSensorsHub();
  initSensorRealtimeListener();
});

function initSensorRealtimeListener() {
  if (typeof window.subscribeTelemetry === 'function') {
    window.subscribeTelemetry((eventType, data) => {
      if (!data) return;
      if (['device-ping', 'stage-telemetry', 'sensor-reading', 'telemetry', 'device-registered'].includes(eventType)) {
        // Update device last seen or state
        if (data.deviceId) {
          const dev = allSensors.find(s => s.deviceId === data.deviceId);
          if (dev) {
            dev.lastSeenAt = new Date().toISOString();
            dev.status = 'active';
            renderSensorCards();
            updateSummaryMetrics();
          }
        }
      }
    });
  }
}

// -----------------------------------------------------------------
// DATA LOADING
// -----------------------------------------------------------------
async function loadSensorsHub() {
  const container = document.getElementById('sensorsContainer');
  if (container) {
    container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">Loading sensors from database...</div>`;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/devices`);
    if (res.ok) {
      allSensors = await res.json();
    } else {
      console.warn('Failed to fetch devices, fallback to platform state');
      const stateRes = await fetch(`${BACKEND_URL}/api/state`);
      if (stateRes.ok) {
        const state = await stateRes.json();
        allSensors = state.devices || [];
      }
    }
  } catch (err) {
    console.error('Error loading sensors:', err);
  }

  updateSummaryMetrics();
  renderSensorCards();
}

function updateSummaryMetrics() {
  const total = allSensors.length;
  const online = allSensors.filter(s => s.status === 'active').length;
  const uniqueStages = new Set(allSensors.map(s => s.processStage).filter(Boolean)).size;

  let totalChannels = 0;
  allSensors.forEach(s => {
    const params = Array.isArray(s.capturedParameters) ? s.capturedParameters : [];
    totalChannels += params.length;
  });

  const mTotal = document.getElementById('metricTotalSensors');
  const mOnline = document.getElementById('metricOnlineSensors');
  const mMapped = document.getElementById('metricMappedStages');
  const mChannels = document.getElementById('metricTotalChannels');

  if (mTotal) mTotal.textContent = total;
  if (mOnline) mOnline.textContent = online;
  if (mMapped) mMapped.textContent = `${uniqueStages}/8`;
  if (mChannels) mChannels.textContent = totalChannels;
}

// -----------------------------------------------------------------
// RENDERING
// -----------------------------------------------------------------
function renderSensorCards() {
  const container = document.getElementById('sensorsContainer');
  if (!container) return;

  const query = currentSearchQuery.toLowerCase().trim();
  const filtered = allSensors.filter(s => {
    const matchStage = currentFilterStage === 'all' || s.processStage === currentFilterStage;
    const matchCat = currentFilterCategory === 'all' || s.category === currentFilterCategory;
    const matchProt = currentFilterProtocol === 'all' || (s.protocol || '').includes(currentFilterProtocol);
    const matchSearch = !query ||
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.deviceId && s.deviceId.toLowerCase().includes(query)) ||
      (s.model && s.model.toLowerCase().includes(query)) ||
      (s.stationId && s.stationId.toLowerCase().includes(query)) ||
      (s.processStage && s.processStage.toLowerCase().includes(query));

    return matchStage && matchCat && matchProt && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px; background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 12px;">
        <h4 style="color: #475569; margin: 0 0 8px 0;">No sensors found matching your criteria</h4>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 16px;">Try adjusting your filters or register a new hardware sensor.</p>
        <button class="button button--primary" onclick="openAddSensorModal()">+ Register New Sensor</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const isOnline = s.status === 'active';
    const params = Array.isArray(s.capturedParameters) ? s.capturedParameters : [];
    const lastSeenText = s.lastSeenAt ? formatRelativeTime(s.lastSeenAt) : 'Never';

    const categoryIcons = {
      'NIR Spectroscopy': '🔬',
      'Gravimetric / Load Cell': '⚖️',
      'Torque / Rheology': '🧪',
      'Thermal & Moisture': '💨',
      'Piezoelectric / Force': '💊',
      'Vision Camera & HPLC': '🏆',
      'Analytical Chemistry / pH': '🧪',
      'Environmental Transducer': '🌡️'
    };
    const icon = categoryIcons[s.category] || '📟';

    return `
      <div class="sensor-card" id="card-${s.deviceId}">
        <div>
          <!-- Header -->
          <div class="sensor-card-header">
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 1.15rem;">${icon}</span>
                <h4 class="sensor-name">${escapeHtml(s.name)}</h4>
              </div>
              <div class="sensor-model">Tag: <strong>${escapeHtml(s.deviceId)}</strong> ${s.model ? `• ${escapeHtml(s.model)}` : ''}</div>
            </div>
            <span class="badge ${isOnline ? 'badge--pass' : 'badge--neutral'}" style="font-size: 0.76rem; font-weight: 700; white-space: nowrap;">
              <span class="live-dot" style="background: ${isOnline ? '#16a34a' : '#94a3b8'};"></span>
              ${isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <!-- Where It Connects Box -->
          <div class="topology-box">
            <div class="topology-title">
              <span>📍</span> WHERE IT CONNECTS (Process Topology)
            </div>
            <div class="topology-row">
              <span class="topology-label">Process Stage:</span>
              <span class="topology-val" style="color: #2563eb;">${escapeHtml(s.processStage || 'Raw Material Receipt')}</span>
            </div>
            <div class="topology-row">
              <span class="topology-label">Station / Suite:</span>
              <span class="topology-val">${escapeHtml(s.stationId || 'STATION-01')}</span>
            </div>
            <div class="topology-row">
              <span class="topology-label">Line / Interface:</span>
              <span class="topology-val">${escapeHtml(s.lineName || 'Line 1')} • <span style="font-family: monospace; font-size: 0.8rem; background: #e2e8f0; padding: 1px 5px; border-radius: 4px;">${escapeHtml(s.protocol || 'HTTP REST')}</span></span>
            </div>
            ${s.endpointUrl ? `
            <div class="topology-row">
              <span class="topology-label">Network Endpoint:</span>
              <span class="topology-val" style="font-family: monospace; font-size: 0.78rem; color: #475569;">${escapeHtml(s.endpointUrl)}</span>
            </div>` : ''}
          </div>

          <!-- What It Captures Box -->
          <div class="capture-box">
            <div class="capture-title">
              <span>⚡</span> WHAT IT CAPTURES (${params.length} Channels • ${s.sampleRate || '10s'})
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${params.length > 0 ? params.map(p => `
                <span class="param-pill" title="${p.description || p.name}">
                  ${escapeHtml(p.name)} <span style="color: #166534; font-size: 0.72rem;">(${escapeHtml(p.unit || '')})</span>
                </span>
              `).join('') : '<span style="color:#64748b; font-size:0.8rem; font-style:italic;">No parameter channels defined</span>'}
            </div>
          </div>

          <!-- Diagnostics row -->
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #64748b; margin-bottom: 0.5rem; padding: 0 4px;">
            <span>Last Telemetry: <strong>${lastSeenText}</strong></span>
            <span>Auth: <strong>API Key Active</strong></span>
          </div>
        </div>

        <!-- Actions -->
        <div class="sensor-card-actions">
          <button type="button" class="button button--secondary" onclick="pingSensor('${s.deviceId}')" title="Test Hardware Ping Packet">
            ⚡ Ping
          </button>
          <button type="button" class="button button--secondary" onclick="openSnippetModal('${s.deviceId}')" title="View ESP32 / Python Ingestion Snippet">
            &lt;/&gt; Code
          </button>
          <button type="button" class="button button--secondary" onclick="openEditSensorModal('${s.deviceId}')" title="Edit & Re-map Topology">
            ✏️ Edit
          </button>
          <button type="button" class="button button--secondary" onclick="deleteSensor('${s.deviceId}')" style="color: #dc2626;" title="Delete Sensor">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------------------------------------------
// FILTER HANDLERS
// -----------------------------------------------------------------
function applySensorFilters() {
  currentSearchQuery = document.getElementById('sensorSearchInput')?.value || '';
  currentFilterStage = document.getElementById('stageFilterSelect')?.value || 'all';
  currentFilterCategory = document.getElementById('categoryFilterSelect')?.value || 'all';
  currentFilterProtocol = document.getElementById('protocolFilterSelect')?.value || 'all';
  renderSensorCards();
}

// -----------------------------------------------------------------
// MODAL: ADD / EDIT SENSOR
// -----------------------------------------------------------------
function openAddSensorModal() {
  document.getElementById('sensorModalTitle').textContent = 'Register New Hardware Sensor';
  document.getElementById('editSensorId').value = '';
  document.getElementById('sensorNameInput').value = '';
  document.getElementById('sensorTagInput').value = `PAT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-01`;
  document.getElementById('sensorModelInput').value = '';
  document.getElementById('sensorCategorySelect').value = 'NIR Spectroscopy';
  document.getElementById('sensorStageSelect').value = 'Raw Material Receipt';
  document.getElementById('sensorStationInput').value = 'STATION-01 (RM Receipt)';
  document.getElementById('sensorLineInput').value = 'Line 1 (Granulation)';
  document.getElementById('sensorProtocolSelect').value = 'HTTP REST';
  document.getElementById('sensorEndpointInput').value = 'http://192.168.1.105:8080/api/sensor';
  document.getElementById('sensorSampleRateSelect').value = '10s';

  const container = document.getElementById('parameterRowsContainer');
  container.innerHTML = '';
  addParameterRow('NIR Spectral Identity (R)', 'Pearson R', 'Spectrum', '0.98 - 1.00');
  addParameterRow('Residual Moisture (LOD)', '%', 'Float', '0.5 - 2.0%');

  openModal('sensorModal', 'sensorModalBackdrop');
}

function openEditSensorModal(deviceId) {
  const sensor = allSensors.find(s => s.deviceId === deviceId);
  if (!sensor) return;

  document.getElementById('sensorModalTitle').textContent = `Edit & Re-Map Sensor [${sensor.deviceId}]`;
  document.getElementById('editSensorId').value = sensor.deviceId;
  document.getElementById('sensorNameInput').value = sensor.name || '';
  document.getElementById('sensorTagInput').value = sensor.deviceId || '';
  document.getElementById('sensorTagInput').readOnly = true;
  document.getElementById('sensorModelInput').value = sensor.model || '';
  document.getElementById('sensorCategorySelect').value = sensor.category || 'NIR Spectroscopy';
  document.getElementById('sensorStageSelect').value = sensor.processStage || 'Raw Material Receipt';
  document.getElementById('sensorStationInput').value = sensor.stationId || '';
  document.getElementById('sensorLineInput').value = sensor.lineName || 'Line 1';
  document.getElementById('sensorProtocolSelect').value = sensor.protocol || 'HTTP REST';
  document.getElementById('sensorEndpointInput').value = sensor.endpointUrl || '';
  document.getElementById('sensorSampleRateSelect').value = sensor.sampleRate || '10s';

  const container = document.getElementById('parameterRowsContainer');
  container.innerHTML = '';
  const params = Array.isArray(sensor.capturedParameters) ? sensor.capturedParameters : [];
  if (params.length > 0) {
    params.forEach(p => {
      addParameterRow(p.name, p.unit, p.dataType, p.spec || `${p.minSpec || ''} - ${p.maxSpec || ''}`);
    });
  } else {
    addParameterRow('Process Parameter', '%', 'Float', 'Target ±5%');
  }

  openModal('sensorModal', 'sensorModalBackdrop');
}

function addParameterRow(name = '', unit = '', dataType = 'Float', spec = '') {
  const container = document.getElementById('parameterRowsContainer');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'param-entry-row';
  row.innerHTML = `
    <input type="text" class="param-name" value="${escapeHtml(name)}" placeholder="Parameter name..." required />
    <input type="text" class="param-unit" value="${escapeHtml(unit)}" placeholder="Unit (%)" />
    <select class="param-type">
      <option value="Float" ${dataType === 'Float' ? 'selected' : ''}>Float</option>
      <option value="Spectrum" ${dataType === 'Spectrum' ? 'selected' : ''}>Spectrum</option>
      <option value="Image" ${dataType === 'Image' ? 'selected' : ''}>AI Image</option>
      <option value="Integer" ${dataType === 'Integer' ? 'selected' : ''}>Integer</option>
      <option value="Barcode" ${dataType === 'Barcode' ? 'selected' : ''}>Barcode</option>
    </select>
    <input type="text" class="param-spec" value="${escapeHtml(spec)}" placeholder="Spec / Tolerance" />
    <button type="button" class="button button--secondary" onclick="this.closest('.param-entry-row').remove()" style="padding: 2px 6px; color: #dc2626;" title="Remove">✕</button>
  `;
  container.appendChild(row);
}

async function saveSensorConfiguration() {
  const editId = document.getElementById('editSensorId').value.trim();
  const name = document.getElementById('sensorNameInput').value.trim();
  const deviceId = document.getElementById('sensorTagInput').value.trim();
  const model = document.getElementById('sensorModelInput').value.trim();
  const category = document.getElementById('sensorCategorySelect').value;
  const processStage = document.getElementById('sensorStageSelect').value;
  const stationId = document.getElementById('sensorStationInput').value.trim();
  const lineName = document.getElementById('sensorLineInput').value.trim();
  const protocol = document.getElementById('sensorProtocolSelect').value;
  const endpointUrl = document.getElementById('sensorEndpointInput').value.trim();
  const sampleRate = document.getElementById('sensorSampleRateSelect').value;

  if (!name || !deviceId) {
    showToast('Sensor Name and Device Tag are required', 'error');
    return;
  }

  // Collect parameters
  const rows = document.querySelectorAll('#parameterRowsContainer .param-entry-row');
  const capturedParameters = [];
  rows.forEach(r => {
    const pName = r.querySelector('.param-name')?.value.trim();
    const pUnit = r.querySelector('.param-unit')?.value.trim();
    const pType = r.querySelector('.param-type')?.value;
    const pSpec = r.querySelector('.param-spec')?.value.trim();
    if (pName) {
      capturedParameters.push({
        name: pName,
        unit: pUnit || '%',
        dataType: pType || 'Float',
        spec: pSpec || 'Validated SOP Range'
      });
    }
  });

  const payload = {
    name,
    deviceId,
    model,
    category,
    processStage,
    stationId,
    lineName,
    protocol,
    connectionType: protocol,
    endpointUrl,
    sampleRate,
    capturedParameters
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`${BACKEND_URL}/api/devices/${encodeURIComponent(editId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch(`${BACKEND_URL}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      closeSensorModal();
      showToast(`Sensor [${deviceId}] successfully saved!`, 'success');
      await loadSensorsHub();
    } else {
      const err = await res.json();
      showToast(`Save failed: ${err.error || 'Server error'}`, 'error');
    }
  } catch (err) {
    console.error('Error saving sensor:', err);
    showToast('Failed to connect to backend server', 'error');
  }
}

function closeSensorModal() {
  closeModal('sensorModal', 'sensorModalBackdrop');
}

// -----------------------------------------------------------------
// ACTIONS: PING & DELETE
// -----------------------------------------------------------------
async function pingSensor(deviceId) {
  const card = document.getElementById(`card-${deviceId}`);
  if (card) card.style.borderColor = '#3b82f6';

  try {
    const res = await fetch(`${BACKEND_URL}/api/devices/${encodeURIComponent(deviceId)}/ping`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`⚡ Ping successful for [${deviceId}]: Latency ${data.latencyMs} ms`, 'success');
      const s = allSensors.find(x => x.deviceId === deviceId);
      if (s) {
        s.lastSeenAt = new Date().toISOString();
        s.status = 'active';
        renderSensorCards();
        updateSummaryMetrics();
      }
    } else {
      showToast(`Ping failed for [${deviceId}]`, 'error');
    }
  } catch (e) {
    showToast(`Failed to ping [${deviceId}]`, 'error');
  }

  setTimeout(() => {
    if (card) card.style.borderColor = '';
  }, 1000);
}

async function simulateAllTelemetry() {
  showToast('⚡ Pinging all registered sensors and verifying live telemetry feeds...', 'info');
  for (const s of allSensors) {
    await pingSensor(s.deviceId);
  }
}

async function deleteSensor(deviceId) {
  if (!confirm(`Are you sure you want to decommission and remove sensor [${deviceId}]?`)) {
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      showToast(`Sensor [${deviceId}] deleted`, 'success');
      await loadSensorsHub();
    } else {
      showToast('Failed to delete sensor', 'error');
    }
  } catch (e) {
    showToast('Connection error', 'error');
  }
}

// -----------------------------------------------------------------
// MODAL: CODE GENERATOR (ESP32, PYTHON, CURL)
// -----------------------------------------------------------------
function openSnippetModal(deviceId) {
  const sensor = allSensors.find(s => s.deviceId === deviceId);
  if (!sensor) return;

  activeSnippetDevice = sensor;
  document.getElementById('snippetModalTitle').textContent = `Integration Code: ${sensor.name}`;
  document.getElementById('snippetModalSubtitle').textContent = `Target Stage: ${sensor.processStage} • Tag: ${sensor.deviceId} • Auth Key: ${sensor.apiKey || 'key-prod'}`;
  
  switchSnippetTab('esp32');
  openModal('snippetModal', 'snippetModalBackdrop');
}

function switchSnippetTab(tab) {
  activeSnippetTab = tab;
  ['esp32', 'python', 'curl'].forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) {
      if (t === tab) {
        btn.classList.add('button--primary');
        btn.classList.remove('button--secondary');
      } else {
        btn.classList.remove('button--primary');
        btn.classList.add('button--secondary');
      }
    }
  });

  renderSnippetCode();
}

function renderSnippetCode() {
  const codeBlock = document.getElementById('snippetCodeBlock');
  if (!codeBlock || !activeSnippetDevice) return;

  const s = activeSnippetDevice;
  const backendBase = BACKEND_URL.replace(/\/+$/, '');
  const params = Array.isArray(s.capturedParameters) ? s.capturedParameters : [{ name: 'Parameter1', unit: '%' }];

  // Build sample payload object
  const sampleParamsObj = {};
  params.forEach(p => {
    sampleParamsObj[p.name] = (p.dataType === 'Integer' ? 20 : (p.dataType === 'Spectrum' ? 0.9942 : 15.4));
  });

  let code = '';

  if (activeSnippetTab === 'esp32') {
    code = `/*
 * ESP32 Hardware Telemetry Client
 * Device: ${s.name} [${s.deviceId}]
 * Process Stage: ${s.processStage}
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "PHARMA_SECURE_WIFI";
const char* password = "CLEANROOM_ACCESS_KEY";

const char* serverUrl = "${backendBase}/api/telemetry/ingest";
const char* apiKey = "${s.apiKey || 'SECURE_DEVICE_KEY'}";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", "${s.deviceId}");
    http.addHeader("x-api-key", apiKey);

    // Build JSON Payload
    StaticJsonDocument<512> doc;
    doc["deviceId"] = "${s.deviceId}";
    doc["stage"] = "${s.processStage}";
    doc["operator"] = "IoT Gateway (${s.model || 'Transducer'})";

    JsonObject params = doc.createNestedObject("parameters");
${params.map(p => `    params["${p.name}"] = read_${p.name.replace(/[^a-zA-Z0-9]/g, '_')}(); // ${p.unit || ''}`).join('\n')}

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);
    Serial.printf("[HTTP] Ingestion Response: %d\\n", httpResponseCode);
    http.end();
  }
  delay(${s.sampleRate === '1s' ? '1000' : (s.sampleRate === '5s' ? '5000' : '10000')}); // ${s.sampleRate || '10s'} Interval
}
`;
  } else if (activeSnippetTab === 'python') {
    code = `"""
Python PAT Sensor & Instrument Gateway
Device: ${s.name} [${s.deviceId}]
Target Stage: ${s.processStage}
"""

import time
import requests
import json

SERVER_URL = "${backendBase}/api/telemetry/ingest"
DEVICE_ID = "${s.deviceId}"
API_KEY = "${s.apiKey || 'SECURE_DEVICE_KEY'}"

def stream_telemetry():
    payload = {
        "deviceId": DEVICE_ID,
        "stage": "${s.processStage}",
        "operator": "Python PAT Daemon (${s.model || 'Hardware Agent'})",
        "parameters": ${JSON.stringify(sampleParamsObj, null, 4)}
    }
    
    headers = {
        "Content-Type": "application/json",
        "x-device-id": DEVICE_ID,
        "x-api-key": API_KEY
    }

    try:
        response = requests.post(SERVER_URL, json=payload, headers=headers, timeout=5)
        print(f"[{time.strftime('%X')}] Ingested: HTTP {response.status_code} -> {response.json()}")
    except Exception as e:
        print(f"Error streaming telemetry: {e}")

if __name__ == "__main__":
    print(f"⚡ Streaming from [{DEVICE_ID}] to {SERVER_URL}...")
    while True:
        stream_telemetry()
        time.sleep(${s.sampleRate === '1s' ? 1 : (s.sampleRate === '5s' ? 5 : 10)})
`;
  } else if (activeSnippetTab === 'curl') {
    code = `curl -X POST "${backendBase}/api/telemetry/ingest" \\
  -H "Content-Type: application/json" \\
  -H "x-device-id: ${s.deviceId}" \\
  -H "x-api-key: ${s.apiKey || 'SECURE_DEVICE_KEY'}" \\
  -d '${JSON.stringify({
    deviceId: s.deviceId,
    stage: s.processStage,
    operator: `IoT Ingest (${s.model || 'Sensor'})`,
    parameters: sampleParamsObj
  }, null, 2)}'`;
  }

  codeBlock.textContent = code;
}

function copySnippetCode() {
  const codeBlock = document.getElementById('snippetCodeBlock');
  if (codeBlock) {
    navigator.clipboard.writeText(codeBlock.textContent).then(() => {
      showToast('Integration code copied to clipboard!', 'success');
    });
  }
}

function closeSnippetModal() {
  closeModal('snippetModal', 'snippetModalBackdrop');
}

// -----------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------
function openModal(panelId, backdropId) {
  const panel = document.getElementById(panelId);
  const backdrop = document.getElementById(backdropId);
  if (panel && backdrop) {
    panel.classList.remove('hidden');
    backdrop.classList.remove('hidden');
  }
}

function closeModal(panelId, backdropId) {
  const panel = document.getElementById(panelId);
  const backdrop = document.getElementById(backdropId);
  if (panel && backdrop) {
    panel.classList.add('hidden');
    backdrop.classList.add('hidden');
  }
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 10) return 'Just now (Live)';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1e293b;color:#ffffff;padding:12px 20px;border-radius:8px;font-size:0.9rem;box-shadow:0 8px 24px rgba(0,0,0,0.2);z-index:9999;transition:opacity 0.3s ease;';
  if (type === 'success') toast.style.borderLeft = '4px solid #16a34a';
  if (type === 'error') toast.style.borderLeft = '4px solid #dc2626';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
