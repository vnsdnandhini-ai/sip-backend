const BACKEND_URL = 'https://sip-backend-1.onrender.com';

async function fetchLiveAnalyticalData() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const liveData = await response.json();
    if (liveData.analyticalData && liveData.analyticalData.length) {
     const liveFormatted = liveData.analyticalData.map((item) => {
          const isManualEntry = item.readingType === 'manual' && item.parameter;
if (item.dataType === 'image') {
          const imageUrl = item.value || item.imagePath;
          return {
            id: item.id,
            parameter: 'Image',
            instrument: item.deviceId || 'ESP32-CAM',
            value: imageUrl,
            unit: '',
            timestamp: item.receivedAt,
            result: 'Image',
            isLive: true,
            dataType: 'image',
            imageAnalysis: item.imageAnalysis,
          };
        }

        if (item.dataType === 'string') {
          return {
            id: item.id,
            parameter: 'Status',
            instrument: item.deviceId || 'ESP32',
            value: item.stringValue,
            unit: '',
            timestamp: item.receivedAt,
            result: 'Live',
            isLive: true,
          };
        }
         if (isManualEntry) {
            return {
              id: item.id,
              parameter: item.parameter,
              instrument: item.instrument || 'Manual Entry',
              value: item.value,
              unit: item.unit || '',
              timestamp: item.deviceTimestamp || item.receivedAt,
              result: 'Manual',
              isLive: true,
              dataType: 'manual',
            };
          }

        if (item.parameter && item.value) {
            return {
              id: item.id,
              parameter: item.parameter,
              instrument: item.deviceId || 'ESP32',
              value: item.value,
              unit: '',
              timestamp: item.receivedAt,
              result: item.dataType === 'image' ? 'Image' : 'Live',
              isLive: true,
              dataType: item.dataType,
              rawValues: item.values,
              imageAnalysis: item.imageAnalysis,
            };
          }

         return {
            id: item.id,
            parameter: item.parameters ? Object.keys(item.parameters).join(', ') : (item.readingType || 'Sensor Reading'),
            instrument: item.deviceId || 'ESP32',
            value: item.parameters ? Object.values(item.parameters).join(' / ') : '',
            unit: '',
            timestamp: item.receivedAt,
            result: 'Live',
            isLive: true,
            dataType: item.dataType || 'number',
          };
        });
     appState.analyticalData = liveFormatted.reverse();
    }
  } catch (err) {
    console.error('Could not fetch live sensor data:', err);
  }
}
let currentFilter = 'all';
let currentQuery = '';
let sortState = { field: null, direction: 'asc' };

async function refreshDataTable() {
  await fetchLiveAnalyticalData();
  renderSummaryCards();
  renderDataTableView();
}
if (window.location.pathname.split('/').pop() === 'analytical.html') {
  setInterval(async () => {
    await fetchLiveAnalyticalData();
    renderSummaryCards();
    renderDataTableView();
  }, 8000);
}

function renderSummaryCards() {
  const data = appState.analyticalData;
  const counts = { number: 0, string: 0, spectrum: 0, image: 0, manual: 0 };
  data.forEach((item) => {
    const type = item.dataType || 'number';
    if (counts[type] !== undefined) counts[type]++;
  });

  const cardsHtml = `
    <div class="summary-card"><div class="count">${data.length}</div><div class="label">Total Readings</div></div>
    <div class="summary-card"><div class="count">${counts.number}</div><div class="label">Numbers</div></div>
    <div class="summary-card"><div class="count">${counts.string}</div><div class="label">Strings</div></div>
    <div class="summary-card"><div class="count">${counts.spectrum}</div><div class="label">Spectra</div></div>
    <div class="summary-card"><div class="count">${counts.image}</div><div class="label">Images</div></div>
  `;
  const container = document.getElementById('summaryCards');
  if (container) container.innerHTML = cardsHtml;
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderDataTableView();
}

function sortTableBy(field) {
  if (sortState.field === field) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.field = field;
    sortState.direction = 'asc';
  }

  document.querySelectorAll('.sort-arrow').forEach((el) => { el.textContent = ''; });
  const arrowEl = document.getElementById(`arrow-${field}`);
  if (arrowEl) arrowEl.textContent = sortState.direction === 'asc' ? '▲' : '▼';

  renderDataTableView();
}

function renderDataTableView() {
  let data = appState.analyticalData.filter((item) => {
    const matchesFilter = currentFilter === 'all' || (item.dataType || 'number') === currentFilter;
    const matchesQuery = !currentQuery || ['parameter', 'instrument', 'value', 'unit', 'timestamp', 'result']
      .some((field) => String(item[field] || '').toLowerCase().includes(currentQuery));
    return matchesFilter && matchesQuery;
  });

  if (sortState.field) {
    data = [...data].sort((a, b) => {
      const valA = a[sortState.field] ?? '';
      const valB = b[sortState.field] ?? '';
      const numA = Number(valA);
      const numB = Number(valB);
      let comparison;
      if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
        comparison = numA - numB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
  }

  searchTable('dataTable', data, ['parameter', 'instrument', 'value', 'unit', 'timestamp', 'result'], '');
}

function submitAnalyticalData(event) {
  event.preventDefault();
  alert('Manual data entry is not yet connected to the backend. Please use sensor ingestion or contact the developer to enable this feature.');
}
function signOut() {
  appState.session = null;
  saveState();
  window.location.href = 'index.html';
}
function handleCsvUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const requiredHeaders = ['parameter', 'instrument', 'value', 'unit', 'timestamp'];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      alert(`CSV is missing required headers: ${missingHeaders.join(', ')}`);
      return;
    }

    const rows = lines.slice(1).filter((line) => line.trim());
    let successCount = 0;
    let failCount = 0;

    for (const line of rows) {
      const values = line.split(',').map((v) => v.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i]; });

      if (!row.parameter || !row.value) {
        failCount++;
        continue;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/analytical`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parameter: row.parameter,
            instrument: row.instrument,
            value: row.value,
            unit: row.unit,
            timestamp: row.timestamp,
          }),
        });
        if (response.ok) successCount++;
        else failCount++;
      } catch (err) {
        console.error('CSV row upload failed:', err);
        failCount++;
      }
    }

    recordAudit(`CSV Upload: ${successCount} records added, ${failCount} failed`, 'Analytical Data Management');
    alert(`CSV upload complete. ${successCount} records added, ${failCount} failed.`);
    window.location.reload();
  };
  reader.readAsText(file);
}async function deleteSingleReading(id) {
  const confirmed = confirm('Delete this reading permanently?');
  if (!confirmed) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/sensor-data/${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      window.location.reload();
    } else {
      alert('Failed to delete reading.');
    }
  } catch (err) {
    console.error('Error deleting reading:', err);
    alert('Error deleting reading. Check console.');
  }
}

async function clearAllSensorData() {
  const confirmed = confirm('This will permanently delete all sensor readings from the cloud. Continue?');
  if (!confirmed) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/sensor-data`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (response.ok) {
      alert(`Cleared ${data.cleared} readings successfully.`);
      window.location.reload();
    } else {
      alert('Failed to clear data.');
    }
  } catch (err) {
    console.error('Error clearing data:', err);
    alert('Error clearing data. Check console.');
  }
}
const appState = {
  session: null,
  projects: [],
  monitoringPoints: [],
  parameters: [],
  checkoutConditions: [],
  regulatoryRules: [],
  analyticalData: [],
  complianceResults: [],
  auditTrail: [],
  reports: [],
};

const selectors = {
  loginForm: document.getElementById('login-form'),
  pageTitle: document.getElementById('pageTitle'),
  signOutButton: document.getElementById('signOutButton'),
  globalSearch: document.getElementById('globalSearch'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalPanel: document.getElementById('modalPanel'),
};



function initApp() {
  if (selectors.loginForm) {
    selectors.loginForm.addEventListener('submit', handleLogin);
  }
  if (selectors.signOutButton) {
    selectors.signOutButton.addEventListener('click', signOut);
  }
  
  // Only initialize module-specific UI if not on login page
  if (!document.getElementById('login-screen')) {
    bindEvents();
    initializeCurrentModule();
  }
}

function bindEvents() {
  if (document.getElementById('globalSearch')) {
    document.getElementById('globalSearch').addEventListener('input', handleSearch);
  }
 if (document.getElementById('openProjectForm')) {
    document.getElementById('openProjectForm').addEventListener('click', () => openProjectForm());
  }
  if (document.getElementById('openMonitoringForm')) {
    document.getElementById('openMonitoringForm').addEventListener('click', () => openMonitoringForm());
  }
  if (document.getElementById('openParameterForm')) {
    document.getElementById('openParameterForm').addEventListener('click', () => openParameterForm());
  }
  if (document.getElementById('openConditionForm')) {
    document.getElementById('openConditionForm').addEventListener('click', () => openConditionForm());
  }
  if (document.getElementById('openRuleForm')) {
    document.getElementById('openRuleForm').addEventListener('click', () => openRuleForm());
  }
  if (document.getElementById('dataEntryForm')) {
    document.getElementById('dataEntryForm').addEventListener('submit', submitAnalyticalData);
  }
  if (document.getElementById('csvUpload')) {
    document.getElementById('csvUpload').addEventListener('change', handleCsvUpload);
  }
  if (document.getElementById('runCompliance')) {
    document.getElementById('runCompliance').addEventListener('click', executeComplianceEvaluation);
  }
  if (document.getElementById('exportExcel')) {
    document.getElementById('exportExcel').addEventListener('click', () => exportReport('excel'));
  }
  if (document.getElementById('exportPdf')) {
    document.getElementById('exportPdf').addEventListener('click', () => exportReport('pdf'));
  }
 if (document.getElementById('modalBackdrop')) {
    document.getElementById('modalBackdrop').addEventListener('click', closeModal);
  }
  if (document.getElementById('clearDataButton')) {
    document.getElementById('clearDataButton').addEventListener('click', clearAllSensorData);
  }
}

function initializeCurrentModule() {
  const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';
  
  if (currentFile === 'dashboard.html') {
    refreshDashboard();
  } else if (currentFile === 'projects.html') {
    refreshProjectTable();
  } else if (currentFile === 'monitoring.html') {
    refreshMonitoringTable();
  } else if (currentFile === 'parameters.html') {
    refreshParametersTable();
    refreshDataParameterOptions();
  } else if (currentFile === 'checkout.html') {
    refreshCheckoutTable();
  } else if (currentFile === 'rules.html') {
    refreshRulesTable();
  } else if (currentFile === 'analytical.html') {
    refreshDataParameterOptions();
    refreshDataTable();
  } else if (currentFile === 'compliance.html') {
    // Compliance page loads its own data via the Run Evaluation button
  } else if (currentFile === 'reports.html') {
    renderReportPanel();
  } else if (currentFile === 'audit.html') {
    refreshAuditTable();
  }
}
async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!username || !password) {
    alert('Please enter a valid username and password.');
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Login failed.');
      return;
    }

    appState.session = {
      user: data.user.username,
      role: data.user.role,
      token: data.token,
      loggedAt: new Date().toISOString(),
    };
    saveState();
    recordAudit('User Login', 'Login', data.user.username);
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Login failed:', err);
    alert('Could not reach the server. Please try again.');
  }
}
function handleSearch(event) {
  const query = event.target.value.trim().toLowerCase();
  if (!query) {
    initializeCurrentModule();
    return;
  }

  const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';
  if (currentFile === 'projects.html') {
    searchTable('projectsTable', appState.projects, ['name', 'product', 'batchNumber', 'department', 'line', 'status'], query);
  } else if (currentFile === 'monitoring.html') {
    searchTable('monitoringTable', appState.monitoringPoints, ['name', 'location', 'frequency', 'description', 'status'], query);
  } else if (currentFile === 'parameters.html') {
    searchTable('parametersTable', appState.parameters, ['name', 'instrument', 'unit', 'frequency', 'description'], query);
  } else if (currentFile === 'checkout.html') {
    searchTable('checkoutTable', appState.checkoutConditions, ['parameter', 'acceptance', 'warning', 'critical', 'action'], query);
  } else if (currentFile === 'rules.html') {
    searchTable('rulesTable', appState.regulatoryRules, ['name', 'description', 'status'], query);
  } else if (currentFile === 'analytical.html' || currentFile === 'compliance.html') {
    currentQuery = query;
    renderDataTableView();
  }
}

function searchTable(tableId, data, fields, query) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';
  data.filter((item) => fields.some((field) => String(item[field] || '').toLowerCase().includes(query)))
    .forEach((item) => {
      const row = document.createElement('tr');
      if (tableId === 'projectsTable') {
        row.innerHTML = `<td>${item.name}</td><td>${item.product}</td><td>${item.batchNumber}</td><td>${item.department}</td><td>${item.line}</td><td>${item.status}</td><td>${createRowActions(item.id, 'project')}</td>`;
      } else if (tableId === 'monitoringTable') {
        row.innerHTML = `<td>${item.name}</td><td>${item.location}</td><td>${item.frequency}</td><td>${item.description}</td><td>${item.status}</td><td>${createRowActions(item.id, 'monitoring')}</td>`;
      } else if (tableId === 'parametersTable') {
        row.innerHTML = `<td>${item.name}</td><td>${item.instrument}</td><td>${item.unit}</td><td>${item.frequency}</td><td>${item.description}</td><td>${createRowActions(item.id, 'parameter')}</td>`;
      } else if (tableId === 'checkoutTable') {
        row.innerHTML = `<td>${item.parameter}</td><td>${item.acceptance}</td><td>${item.warning}</td><td>${item.critical}</td><td>${item.action}</td><td>${createRowActions(item.id, 'condition')}</td>`;
      } else if (tableId === 'rulesTable') {
        row.innerHTML = `<td>${item.name}</td><td>${item.description}</td><td>${item.status}</td><td>${createRowActions(item.id, 'rule')}</td>`;
    } else if (tableId === 'dataTable') {
          const deleteBtn = item.isLive ? `<button class="table-action-button danger" onclick="deleteSingleReading('${item.id}')">Delete</button>` : '';

          let valueCell = item.value;
         if (item.dataType === 'image' && item.value) {
            const imageUrl = item.value.startsWith('http') ? item.value : `${BACKEND_URL}/${item.value}`;
            const analysisJson = item.imageAnalysis ? JSON.stringify(item.imageAnalysis).replace(/"/g, '&quot;') : 'null';
            valueCell = `<button class="table-action-button" onclick='showImagePopup("${imageUrl}", ${analysisJson})'>View Image</button>`;
          } else if (item.dataType === 'spectrum' && item.rawValues) {
            valueCell = `${item.value} <button class="table-action-button" onclick='showSpectrumChart(${JSON.stringify(item.rawValues)})'>View Chart</button>`;
          }

const resultLabel = item.result || 'Pending';
const badgeClass = resultLabel === 'Live' ? 'badge--live' : resultLabel === 'Image' ? 'badge--image' : resultLabel === 'Manual' ? 'badge--manual' : 'badge--pending';
row.innerHTML = `<td>${item.parameter}</td><td>${item.instrument}</td><td>${valueCell}</td><td>${item.unit}</td><td>${item.timestamp}</td><td><span class="badge ${badgeClass}">${resultLabel}</span></td><td>${deleteBtn}</td>`;
        }
      tbody.appendChild(row);
    });
}

function loadState() {
  const persisted = window.localStorage.getItem('sipState');
  if (!persisted) {
    appState.regulatoryRules = [
      { id: generateId(), name: 'FDA 21 CFR Part 11', description: '', status: 'Active' },
      { id: generateId(), name: 'GMP', description: '', status: 'Active' },
      { id: generateId(), name: 'ICH Q8', description: '', status: 'Active' },
      { id: generateId(), name: 'ICH Q9', description: '', status: 'Active' },
      { id: generateId(), name: 'ICH Q10', description: '', status: 'Active' },
      { id: generateId(), name: 'SOP', description: '', status: 'Active' },
    ];
    saveState();
    return;
  }

  const state = JSON.parse(persisted);
  Object.assign(appState, state);
}

function saveState() {
  window.localStorage.setItem('sipState', JSON.stringify(appState));
}

async function recordAudit(activity, module, user = appState.session?.user || 'system') {
  try {
    await fetch(`${BACKEND_URL}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity, module, user }),
    });
  } catch (err) {
    console.error('Failed to record audit entry:', err);
  }
}function openModal(title, contentHtml, onSubmitLabel, onSubmit) {
  selectors.modalPanel.innerHTML = `<h3>${title}</h3>${contentHtml}`;
  if (onSubmitLabel && onSubmit) {
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'button button--primary';
    submit.textContent = onSubmitLabel;
    submit.addEventListener('click', onSubmit);
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button button--secondary';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeModal);
    actions.append(cancel, submit);
    selectors.modalPanel.appendChild(actions);
  }
  selectors.modalBackdrop.classList.remove('hidden');
  selectors.modalPanel.classList.remove('hidden');
}

function closeModal() {
  selectors.modalBackdrop.classList.add('hidden');
  selectors.modalPanel.classList.add('hidden');
}

function generateId() {
  return `id_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function formatValue(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : value;
}

function createRowActions(id, type) {
  return `
    <button class="table-action-button" data-row="${id}" data-type="${type}" data-action="edit">Edit</button>
    <button class="table-action-button danger" data-row="${id}" data-type="${type}" data-action="delete">Delete</button>
  `;
}

function captureTableActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.row;
  const type = button.dataset.type;
  const action = button.dataset.action;
  if (action === 'edit') {
    if (type === 'project') openProjectForm(id);
    if (type === 'monitoring') openMonitoringForm(id);
    if (type === 'parameter') openParameterForm(id);
    if (type === 'condition') openConditionForm(id);
    if (type === 'rule') openRuleForm(id);
  }
  if (action === 'delete') {
    if (!confirm('Confirm deletion of this record?')) return;
    if (type === 'project') deleteProject(id);
    if (type === 'monitoring') deleteMonitoringPoint(id);
    if (type === 'parameter') deleteParameter(id);
    if (type === 'condition') deleteCheckoutCondition(id);
    if (type === 'rule') deleteRegulatoryRule(id);
  }
}

document.addEventListener('click', captureTableActions);

function setupDataSelection() {
  const parameterSelect = document.getElementById('dataParameter');
  parameterSelect.innerHTML = '<option value="">Choose parameter</option>';
  appState.parameters.forEach((parameter) => {
    const option = document.createElement('option');
    option.value = parameter.id;
    option.textContent = `${parameter.name} (${parameter.instrument})`;
    parameterSelect.appendChild(option);
  });
  parameterSelect.addEventListener('change', () => {
    const parameter = appState.parameters.find((item) => item.id === parameterSelect.value);
    document.getElementById('dataInstrument').value = parameter?.instrument || '';
    document.getElementById('dataUnit').value = parameter?.unit || '';
  });
}
function showImagePopup(imageUrl, analysis) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';

  const box = document.createElement('div');
  box.style.cssText = 'background:white;padding:20px;border-radius:8px;max-width:90%;max-height:90%;overflow:auto;';

  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.cssText = 'max-width:100%;max-height:55vh;display:block;';
  box.appendChild(img);

  if (analysis) {
    const qaBadge = analysis.isContaminated
      ? '<span class="badge badge--critical">Contamination Detected</span>'
      : '<span class="badge badge--pass">Sample Clean</span>';

    const edgeBadge = analysis.isIrregularEdges
      ? '<span class="badge badge--warning">Irregular Edges</span>'
      : '<span class="badge badge--pass">Edges Normal</span>';

    const captureBadge = analysis.captureQualityOk
      ? '<span class="badge badge--pass">Capture OK</span>'
      : '<span class="badge badge--warning">Capture Quality Issue</span>';

    const colorLine = analysis.colorDeviationPercent !== null
      ? `<div><strong>Color Deviation:</strong> ${analysis.colorDeviationPercent}% from reference</div>`
      : '';

    const edgeLine = analysis.edgeDensityPercent !== undefined
      ? `<div><strong>Edge Density:</strong> ${analysis.edgeDensityPercent}% (avg mag: ${analysis.averageEdgeMagnitude})</div>`
      : '';

    const captureIssues = [];
    if (analysis.isTooDark) captureIssues.push('too dark');
    if (analysis.isOverexposed) captureIssues.push('overexposed');
    if (analysis.isBlurry) captureIssues.push('blurry');
    const captureIssuesText = captureIssues.length ? ` (${captureIssues.join(', ')})` : '';

    // --- AI VISION SECTION with DEFECT HEATMAPS ---
    let aiHtml = '';
    if (analysis.ai) {
      const ai = analysis.ai;
      let badgeCls = 'badge--pass';
      if (ai.visual_qa_result === 'WARNING') badgeCls = 'badge--warning';
      if (ai.visual_qa_result === 'CRITICAL') badgeCls = 'badge--critical';
      if (ai.visual_qa_result === 'REVIEW REQUIRED') badgeCls = 'badge--warning';

      const isDefective = ai.condition && !['healthy', 'normal'].includes(ai.condition.toLowerCase());
      let heatmapHtml = '';

      if (isDefective && (ai.gradcam_heatmap || ai.pixel_anomaly_map)) {
        const cols = ai.gradcam_heatmap ? '1fr 1fr' : '1fr';
        let mapsHtml = '';
        if (ai.pixel_anomaly_map) {
          mapsHtml += '<div><div style="font-size:0.75rem;color:#64748b;margin-bottom:3px;text-align:center;">Colour Anomaly Map</div>' +
            '<img src="' + ai.pixel_anomaly_map + '" style="width:100%;border-radius:6px;border:2px solid #fca5a5;cursor:pointer;" onclick="this.requestFullscreen?this.requestFullscreen():null" title="Click to enlarge"/></div>';
        }
        if (ai.gradcam_heatmap) {
          mapsHtml += '<div><div style="font-size:0.75rem;color:#64748b;margin-bottom:3px;text-align:center;">AI Grad-CAM Heatmap</div>' +
            '<img src="' + ai.gradcam_heatmap + '" style="width:100%;border-radius:6px;border:2px solid #f97316;cursor:pointer;" onclick="this.requestFullscreen?this.requestFullscreen():null" title="Click to enlarge"/></div>';
        }
        heatmapHtml = '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #fca5a5;">' +
          '<div style="font-size:0.85rem;font-weight:600;color:#dc2626;margin-bottom:8px;">&#9888; Defect Zones Highlighted</div>' +
          '<div style="display:grid;grid-template-columns:' + cols + ';gap:8px;">' + mapsHtml + '</div>' +
          '<div style="font-size:0.72rem;color:#94a3b8;margin-top:5px;text-align:center;">Red/orange = suspected defect areas &bull; Click to enlarge</div></div>';
      } else if (ai.pixel_anomaly_map && !isDefective) {
        heatmapHtml = '<div style="margin-top:10px;"><div style="font-size:0.75rem;color:#64748b;margin-bottom:3px;">Colour Analysis Map (No anomalies)</div>' +
          '<img src="' + ai.pixel_anomaly_map + '" style="width:100%;border-radius:6px;border:2px solid #86efac;opacity:0.85;"/></div>';
      }

      aiHtml = `
        <div style="margin-top:10px;padding-top:10px;border-top:2px dashed #cbd5e1;">
          <h4 style="margin:0 0 8px 0;color:#334155;font-size:0.95rem;">AI Vision Analysis <span style="font-weight:normal;font-size:0.75rem;color:#94a3b8;">(${ai.ai_model_version})</span></h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;">
            <div><strong>Material:</strong> ${ai.raw_material_class}</div>
            <div><strong>Condition:</strong> ${ai.condition}</div>
            <div><strong>Confidence:</strong> ${ai.confidence_score}%</div>
            <div><strong>Defect:</strong> ${ai.detected_defect}</div>
          </div>
          <div style="margin-top:6px;"><strong>AI Result:</strong> <span class="badge ${badgeCls}">${ai.visual_qa_result}</span></div>
        ` + heatmapHtml + '</div>';
    }

    const infoBox = document.createElement('div');
    infoBox.style.cssText = 'margin-top:14px;padding:12px;background:#f8fafc;border-radius:10px;font-size:0.88rem;';
    infoBox.innerHTML = `
      <div style="margin-bottom:10px;">${qaBadge} ${edgeBadge}</div>
      <div><strong>Contamination:</strong> ${analysis.contaminationPercent}% of surface area</div>
      ${colorLine}
      ${edgeLine}
      <hr style="margin:10px 0;border:none;border-top:1px solid #e2e8f0;"/>
      <div style="margin-bottom:6px;">${captureBadge}${captureIssuesText}</div>
      <div style="color:#64748b;font-size:0.82rem;">Brightness: ${analysis.brightness} | Sharpness: ${analysis.sharpness}</div>
      ${aiHtml}
    `;
    box.appendChild(infoBox);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'margin-top:14px;padding:8px 16px;';
  closeBtn.onclick = () => document.body.removeChild(overlay);
  box.appendChild(closeBtn);

  // ---- CLIENT-SIDE CANVAS DEFECT HIGHLIGHTER ----
  // Works on ALL existing images using adaptive local anomaly detection
  const highlightWrap = document.createElement('div');
  highlightWrap.style.cssText = 'margin-top:10px;';

  const highlightBtn = document.createElement('button');
  highlightBtn.innerHTML = '&#128269; Highlight Defect Areas';
  highlightBtn.style.cssText = [
    'padding:8px 16px','background:#dc2626','color:white','border:none',
    'border-radius:6px','cursor:pointer','font-size:0.85rem','font-weight:600','width:100%'
  ].join(';') + ';';
  highlightWrap.appendChild(highlightBtn);

  // Side-by-side container (hidden until button is clicked)
  const sideBySide = document.createElement('div');
  sideBySide.style.cssText = 'display:none;margin-top:10px;';

  sideBySide.innerHTML = '<div style="font-size:0.8rem;font-weight:600;color:#dc2626;margin-bottom:6px;">&#9888; Defect Analysis — Anomalous regions highlighted in red</div>';

  const panelRow = document.createElement('div');
  panelRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';

  // Left panel — Original
  const origPanel = document.createElement('div');
  origPanel.innerHTML = '<div style="font-size:0.72rem;font-weight:600;color:#475569;text-align:center;margin-bottom:4px;padding:3px;background:#f1f5f9;border-radius:4px;">&#128248; Original Image</div>';
  const origCanvas = document.createElement('canvas');
  origCanvas.style.cssText = 'width:100%;border-radius:6px;border:2px solid #cbd5e1;';
  origPanel.appendChild(origCanvas);

  // Right panel — Defect map
  const defPanel = document.createElement('div');
  defPanel.innerHTML = '<div style="font-size:0.72rem;font-weight:600;color:#dc2626;text-align:center;margin-bottom:4px;padding:3px;background:#fef2f2;border-radius:4px;">&#128308; Defect Map</div>';
  const defCanvas = document.createElement('canvas');
  defCanvas.style.cssText = 'width:100%;border-radius:6px;border:2px solid #fca5a5;cursor:zoom-in;';
  defPanel.appendChild(defCanvas);

  panelRow.appendChild(origPanel);
  panelRow.appendChild(defPanel);
  sideBySide.appendChild(panelRow);

  // Stats bar
  const statsBar = document.createElement('div');
  statsBar.style.cssText = 'margin-top:6px;padding:6px 10px;background:#fef2f2;border-radius:6px;font-size:0.75rem;color:#64748b;display:flex;gap:16px;flex-wrap:wrap;';
  sideBySide.appendChild(statsBar);

  const legendRow = document.createElement('div');
  legendRow.style.cssText = 'margin-top:5px;font-size:0.68rem;color:#94a3b8;';
  legendRow.textContent = 'Method: Adaptive local colour deviation from image baseline. Click defect map to fullscreen.';
  sideBySide.appendChild(legendRow);

  highlightWrap.appendChild(sideBySide);
  box.appendChild(highlightWrap);

  let isHighlighted = false;

  highlightBtn.addEventListener('click', function() {
    if (isHighlighted) {
      sideBySide.style.display = 'none';
      highlightBtn.innerHTML = '&#128269; Highlight Defect Areas';
      highlightBtn.style.background = '#dc2626';
      isHighlighted = false;
      return;
    }
    highlightBtn.innerHTML = 'Analyzing...';
    highlightBtn.disabled = true;

    const probe = new Image();
    probe.crossOrigin = 'anonymous';

    probe.onload = function() {
      const W = probe.naturalWidth;
      const H = probe.naturalHeight;

      // --- Draw original ---
      origCanvas.width = W; origCanvas.height = H;
      const octx = origCanvas.getContext('2d');
      octx.drawImage(probe, 0, 0);

      // --- Compute image baseline stats (sample 4000 random pixels) ---
      const srcData = octx.getImageData(0, 0, W, H).data;
      const totalPx  = W * H;
      const step     = Math.max(1, Math.floor(totalPx / 4000));

      let sumR=0, sumG=0, sumB=0, count=0;
      for (let i = 0; i < srcData.length; i += step * 4) {
        sumR += srcData[i]; sumG += srcData[i+1]; sumB += srcData[i+2]; count++;
      }
      const avgR = sumR / count;
      const avgG = sumG / count;
      const avgB = sumB / count;

      // Std deviation
      let varR=0, varG=0, varB=0;
      for (let i = 0; i < srcData.length; i += step * 4) {
        varR += Math.pow(srcData[i]   - avgR, 2);
        varG += Math.pow(srcData[i+1] - avgG, 2);
        varB += Math.pow(srcData[i+2] - avgB, 2);
      }
      const stdR = Math.sqrt(varR / count);
      const stdG = Math.sqrt(varG / count);
      const stdB = Math.sqrt(varB / count);

      // Threshold: pixels that deviate > 1.5 std from image baseline are anomalous
      const THRESH = 1.5;

      // --- Draw defect map ---
      defCanvas.width = W; defCanvas.height = H;
      const dctx = defCanvas.getContext('2d');
      dctx.drawImage(probe, 0, 0);
      const defData = dctx.getImageData(0, 0, W, H);
      const dd = defData.data;

      let anomCount = 0;
      const anomalyMask = new Uint8Array(totalPx);  // 1 = anomalous

      for (let px = 0; px < totalPx; px++) {
        const i  = px * 4;
        const r  = dd[i], g = dd[i+1], b = dd[i+2];
        const dR = Math.abs(r - avgR) / (stdR + 1);
        const dG = Math.abs(g - avgG) / (stdG + 1);
        const dB = Math.abs(b - avgB) / (stdB + 1);
        const score = Math.max(dR, dG, dB);

        if (score > THRESH) {
          // Mark anomalous: keep some colour but punch red channel
          dd[i]   = Math.min(255, r + 140);
          dd[i+1] = Math.max(0,   Math.round(g * 0.3));
          dd[i+2] = Math.max(0,   Math.round(b * 0.3));
          anomalyMask[px] = 1;
          anomCount++;
        } else {
          // Non-anomalous → greyscale with slight opacity to make defects pop
          const grey = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
          const dim  = Math.round(grey * 0.6);
          dd[i] = dim; dd[i+1] = dim; dd[i+2] = dim;
        }
      }
      dctx.putImageData(defData, 0, 0);

      // Outline bounding boxes around dense defect clusters
      const cell = Math.max(12, Math.floor(W / 24));
      dctx.strokeStyle = 'rgba(255,30,30,0.9)';
      dctx.lineWidth   = 2;
      for (let cy = 0; cy < H; cy += cell) {
        for (let cx = 0; cx < W; cx += cell) {
          let cnt = 0, total = 0;
          for (let dy = 0; dy < cell && cy+dy < H; dy++) {
            for (let dx = 0; dx < cell && cx+dx < W; dx++) {
              if (anomalyMask[(cy+dy)*W + (cx+dx)]) cnt++;
              total++;
            }
          }
          if (total > 0 && cnt/total > 0.35) {
            dctx.strokeRect(cx+1, cy+1, Math.min(cell, W-cx)-2, Math.min(cell, H-cy)-2);
          }
        }
      }

      // Header banner on defect map
      const pct = ((anomCount / totalPx) * 100).toFixed(1);
      dctx.fillStyle = 'rgba(0,0,0,0.75)';
      dctx.fillRect(0, 0, W, 22);
      dctx.fillStyle = '#ff8080';
      dctx.font = 'bold 11px sans-serif';
      dctx.fillText('Defect Coverage: ' + pct + '%  |  Grey = normal  |  Red = anomaly', 5, 15);

      // Update stats bar
      statsBar.innerHTML =
        '<span><strong>Defect Coverage:</strong> ' + pct + '%</span>' +
        '<span><strong>Baseline R/G/B:</strong> ' + Math.round(avgR) + ' / ' + Math.round(avgG) + ' / ' + Math.round(avgB) + '</span>' +
        '<span><strong>Std Dev:</strong> ' + Math.round(stdR) + ' / ' + Math.round(stdG) + ' / ' + Math.round(stdB) + '</span>' +
        '<span><strong>Threshold:</strong> ' + THRESH + 'σ</span>';

      sideBySide.style.display = 'block';
      highlightBtn.innerHTML   = 'Hide Defect Map';
      highlightBtn.style.background = '#475569';
      highlightBtn.disabled = false;
      isHighlighted = true;

      defCanvas.onclick = () => { if (defCanvas.requestFullscreen) defCanvas.requestFullscreen(); };
    };

    probe.onerror = function() {
      highlightBtn.innerHTML = '&#9888; Could not load image (CORS)';
      highlightBtn.disabled  = false;
    };
    probe.src = imageUrl;
  });
  // ---- END CANVAS DEFECT HIGHLIGHTER ----

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showSpectrumChart(spectrumValues) {
  const xValues = spectrumValues.xValues || [];
  const yValues = spectrumValues.yValues || [];

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';

  const box = document.createElement('div');
  box.style.cssText = 'background:white;padding:20px;border-radius:8px;';

  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 300;
  box.appendChild(canvas);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'margin-top:10px;padding:8px 16px;';
  closeBtn.onclick = () => document.body.removeChild(overlay);
  box.appendChild(document.createElement('br'));
  box.appendChild(closeBtn);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const ctx = canvas.getContext('2d');
  const padding = 40;
  const w = canvas.width - padding * 2;
  const h = canvas.height - padding * 2;

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, padding + h);
  ctx.lineTo(padding + w, padding + h);
  ctx.stroke();

  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  xValues.forEach((x, i) => {
    const px = padding + ((x - minX) / (maxX - minX || 1)) * w;
    const py = padding + h - ((yValues[i] - minY) / (maxY - minY || 1)) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function refreshDataParameterOptions() {
  setupDataSelection();
}

function initializePlatform() {
  loadState();
  console.log('DEBUG - session at check:', appState.session);
  console.log('DEBUG - login-form exists:', !!document.getElementById('login-form'));
  if (appState.session && document.getElementById('login-form')) {
    // On login page with session - redirect to dashboard
    window.location.href = 'dashboard.html';
  } else if (!appState.session && !document.getElementById('login-form')) {
    // On module page without session - redirect to login
    window.location.href = 'index.html';
} else {
    // Normal initialization
    fetchLiveAnalyticalData().then(async () => {
      const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';
      const skipRedirectPages = ['onboarding.html', 'index.html'];
      if (!skipRedirectPages.includes(currentFile)) {
        try {
          const response = await fetch(`${BACKEND_URL}/api/state`);
          const state = await response.json();
          if (!state.projects || state.projects.length === 0) {
            window.location.href = 'onboarding.html';
            return;
          }
        } catch (err) {
          console.error('Setup check failed:', err);
        }
      }
      initApp();
    });
  }
}
function getDateRangeFromPreset(preset, customStart, customEnd) {
  const now = new Date();
  if (preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }
  if (preset === '7days') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }
  if (preset === '30days') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }
  if (preset === 'custom') {
    return {
      startDate: customStart ? new Date(customStart).toISOString() : null,
      endDate: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : null,
    };
  }
  return null;
}

async function deleteSensorDataRange() {
  const preset = document.getElementById('dataRangePreset').value;
  if (!preset) {
    alert('Please choose a range first.');
    return;
  }

  const customStart = document.getElementById('dataRangeStart').value;
  const customEnd = document.getElementById('dataRangeEnd').value;
  const range = getDateRangeFromPreset(preset, customStart, customEnd);

  if (preset === 'custom' && !customStart && !customEnd) {
    alert('Please pick at least a start or end date for a custom range.');
    return;
  }

  const confirmed = confirm(`Delete all sensor readings in the selected range? This cannot be undone.`);
  if (!confirmed) return;
6
  try {
    const response = await fetch(`${BACKEND_URL}/api/sensor-data/range`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(range),
    });
    const data = await response.json();
    if (response.ok) {
      alert(`Deleted ${data.deleted} readings in the selected range.`);
      window.location.reload();
    } else {
      alert('Failed to delete range.');
    }
  } catch (err) {
    console.error('Error deleting range:', err);
    alert('Error deleting range. Check console.');
  }
}

const rangePresetSelect = document.getElementById('dataRangePreset');
if (rangePresetSelect) {
  rangePresetSelect.addEventListener('change', () => {
    const isCustom = rangePresetSelect.value === 'custom';
    document.getElementById('dataRangeStart').style.display = isCustom ? 'inline-block' : 'none';
    document.getElementById('dataRangeEnd').style.display = isCustom ? 'inline-block' : 'none';
  });
}

if (document.getElementById('deleteRangeButton')) {
  document.getElementById('deleteRangeButton').addEventListener('click', deleteSensorDataRange);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlatform);
} else {
  initializePlatform();
}