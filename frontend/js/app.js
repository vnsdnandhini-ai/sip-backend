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
  if (!document.getElementById('modal-styles')) {
    const s = document.createElement('style');
    s.id = 'modal-styles';
    s.textContent = `
      @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.98) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .modern-btn { padding: 10px 18px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .modern-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      .modern-btn-primary { background: #6366f1; color: white; }
      .modern-btn-primary:hover:not(:disabled) { background: #4f46e5; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
      .modern-btn-danger { background: #ef4444; color: white; }
      .modern-btn-danger:hover:not(:disabled) { background: #dc2626; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239,68,68,0.3); }
      .modern-btn-purple { background: #8b5cf6; color: white; }
      .modern-btn-purple:hover:not(:disabled) { background: #7c3aed; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(139,92,246,0.3); }
      .modern-btn-outline { background: transparent; color: #cbd5e1; border: 1px solid #475569; }
      .modern-btn-outline:hover:not(:disabled) { background: #334155; color: #fff; border-color: #64748b; }
      .modern-btn.active { background: #38bdf8; color: #0f172a; border-color: #38bdf8; box-shadow: 0 0 15px rgba(56,189,248,0.4); }
      .data-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      .data-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 0.85rem; border-bottom: 1px dashed #f1f5f9; }
      .data-row:last-child { border-bottom: none; }
      .data-label { color: #64748b; font-weight: 500; }
      .data-value { color: #0f172a; font-weight: 600; text-align: right; }
    `;
    document.head.appendChild(s);
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:30px;box-sizing:border-box;';

  const modal = document.createElement('div');
  modal.style.cssText = 'width:100%;max-width:1300px;height:100%;max-height:85vh;background:#f8fafc;border-radius:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);display:flex;overflow:hidden;animation:modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);';

  // --- LEFT PANEL (Visuals) ---
  const leftPanel = document.createElement('div');
  leftPanel.style.cssText = 'flex:1.5;background:#0f172a;display:flex;flex-direction:column;position:relative;border-right:1px solid #334155;';

  const viewArea = document.createElement('div');
  viewArea.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;padding:32px;overflow:hidden;position:relative;background-image:radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);';

  const origImg = document.createElement('img');
  origImg.crossOrigin = 'anonymous';
  origImg.src = imageUrl;
  origImg.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;box-shadow:0 15px 40px rgba(0,0,0,0.6);transition:opacity 0.3s;';

  const defCanvas = document.createElement('canvas');
  defCanvas.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;box-shadow:0 15px 40px rgba(0,0,0,0.6);display:none;cursor:zoom-in;';
  defCanvas.onclick = () => { if(defCanvas.requestFullscreen) defCanvas.requestFullscreen(); };

  viewArea.appendChild(origImg);
  viewArea.appendChild(defCanvas);
  
  const visualStatus = document.createElement('div');
  visualStatus.style.cssText = 'position:absolute;top:24px;left:24px;background:rgba(15,23,42,0.85);color:#38bdf8;padding:8px 16px;border-radius:30px;font-size:0.75rem;font-weight:700;backdrop-filter:blur(6px);border:1px solid rgba(56,189,248,0.3);display:none;align-items:center;gap:6px;box-shadow:0 4px 15px rgba(0,0,0,0.3);';
  viewArea.appendChild(visualStatus);

  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = 'height:84px;background:#1e293b;display:flex;align-items:center;justify-content:center;gap:16px;padding:0 24px;border-top:1px solid #334155;box-shadow:0 -10px 20px rgba(0,0,0,0.2);z-index:10;';

  const btnOrig = document.createElement('button');
  btnOrig.className = 'modern-btn modern-btn-outline active';
  btnOrig.innerHTML = '&#128428; Original Image';
  
  const btnHighlight = document.createElement('button');
  btnHighlight.className = 'modern-btn modern-btn-danger';
  btnHighlight.innerHTML = '&#128269; Highlight Defects';

  const btnSegregate = document.createElement('button');
  btnSegregate.className = 'modern-btn modern-btn-purple';
  btnSegregate.innerHTML = '&#9986;&#65039; Segregate Defects';

  bottomBar.appendChild(btnOrig);
  bottomBar.appendChild(btnHighlight);
  bottomBar.appendChild(btnSegregate);

  leftPanel.appendChild(viewArea);
  leftPanel.appendChild(bottomBar);

  // --- RIGHT PANEL (Data) ---
  const rightPanel = document.createElement('div');
  rightPanel.style.cssText = 'flex:1;max-width:440px;background:#f8fafc;padding:40px 32px;overflow-y:auto;position:relative;display:flex;flex-direction:column;';

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  closeBtn.style.cssText = 'position:absolute;top:24px;right:24px;background:#f1f5f9;border:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#64748b;cursor:pointer;transition:all 0.2s;';
  closeBtn.onmouseover = () => { closeBtn.style.background = '#e2e8f0'; closeBtn.style.color = '#0f172a'; };
  closeBtn.onmouseout = () => { closeBtn.style.background = '#f1f5f9'; closeBtn.style.color = '#64748b'; };
  closeBtn.onclick = () => document.body.removeChild(overlay);
  rightPanel.appendChild(closeBtn);

  const title = document.createElement('h2');
  title.textContent = 'Visual Analysis Report';
  title.style.cssText = 'margin:0 0 28px 0;font-size:1.6rem;color:#0f172a;font-weight:800;letter-spacing:-0.03em;';
  rightPanel.appendChild(title);

  if (analysis) {
    const badges = [];
    if(analysis.isContaminated) badges.push('<span style="background:#fee2e2;color:#b91c1c;padding:6px 12px;border-radius:20px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.02em;">&#9888; Contamination</span>');
    else badges.push('<span style="background:#dcfce7;color:#15803d;padding:6px 12px;border-radius:20px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.02em;">&#10004; Clean</span>');
    
    if(analysis.captureQualityOk) badges.push('<span style="background:#dcfce7;color:#15803d;padding:6px 12px;border-radius:20px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.02em;">&#10004; Capture OK</span>');
    else badges.push('<span style="background:#fef3c7;color:#b45309;padding:6px 12px;border-radius:20px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.02em;">&#9888; Capture Issue</span>');

    const badgeContainer = document.createElement('div');
    badgeContainer.style.cssText = 'display:flex;gap:10px;margin-bottom:28px;flex-wrap:wrap;';
    badgeContainer.innerHTML = badges.join('');
    rightPanel.appendChild(badgeContainer);

    if (analysis.ai) {
      const ai = analysis.ai;
      let badgeCls = 'background:#dcfce7;color:#15803d;';
      if (ai.visual_qa_result === 'WARNING' || ai.visual_qa_result === 'REVIEW REQUIRED') badgeCls = 'background:#fef3c7;color:#b45309;';
      if (ai.visual_qa_result === 'CRITICAL') badgeCls = 'background:#fee2e2;color:#b91c1c;';

      const aiCard = document.createElement('div');
      aiCard.className = 'data-card';
      aiCard.style.borderLeft = '5px solid #6366f1';
      aiCard.innerHTML = `
        <div style="font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
          <div style="background:#e0e7ff;padding:6px;border-radius:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          AI Vision Model <span style="font-size:0.7rem;color:#94a3b8;font-weight:600;background:#f1f5f9;padding:2px 8px;border-radius:12px;">v${ai.ai_model_version || '1.0'}</span>
        </div>
        <div class="data-row"><span class="data-label">Material</span> <span class="data-value">${ai.raw_material_class}</span></div>
        <div class="data-row"><span class="data-label">Condition</span> <span class="data-value">${ai.condition}</span></div>
        <div class="data-row"><span class="data-label">Confidence</span> <span class="data-value">${ai.confidence_score}%</span></div>
        <div class="data-row"><span class="data-label">Defect Type</span> <span class="data-value">${ai.detected_defect || 'None'}</span></div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.85rem;font-weight:600;color:#64748b;">System Verdict</span>
          <span style="padding:6px 12px;border-radius:8px;font-size:0.75rem;font-weight:800;letter-spacing:0.02em;${badgeCls}">${ai.visual_qa_result}</span>
        </div>
      `;
      rightPanel.appendChild(aiCard);
    }

    const heuCard = document.createElement('div');
    heuCard.className = 'data-card';
    heuCard.innerHTML = `
      <div style="font-size:0.95rem;font-weight:700;color:#334155;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        Physical Properties
      </div>
      <div class="data-row"><span class="data-label">Surface Contamination</span> <span class="data-value" style="color:${analysis.contaminationPercent > 10 ? '#ef4444' : '#10b981'}">${analysis.contaminationPercent}%</span></div>
      ${analysis.colorDeviationPercent !== null ? `<div class="data-row"><span class="data-label">Colour Deviation</span> <span class="data-value">${analysis.colorDeviationPercent}%</span></div>` : ''}
      ${analysis.edgeDensityPercent !== undefined ? `<div class="data-row"><span class="data-label">Edge Density</span> <span class="data-value">${analysis.edgeDensityPercent}% (Mag: ${analysis.averageEdgeMagnitude})</span></div>` : ''}
    `;
    rightPanel.appendChild(heuCard);

    const capCard = document.createElement('div');
    capCard.className = 'data-card';
    capCard.innerHTML = `
      <div style="font-size:0.95rem;font-weight:700;color:#334155;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
        Optical Quality
      </div>
      <div class="data-row"><span class="data-label">Brightness</span> <span class="data-value">${analysis.brightness}</span></div>
      <div class="data-row"><span class="data-label">Sharpness</span> <span class="data-value">${analysis.sharpness}</span></div>
    `;
    rightPanel.appendChild(capCard);
    
    const dynamicStats = document.createElement('div');
    dynamicStats.id = 'dynamic-analysis-stats';
    dynamicStats.style.cssText = 'margin-top:8px;';
    rightPanel.appendChild(dynamicStats);
  }

  modal.appendChild(leftPanel);
  modal.appendChild(rightPanel);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // --- ANALYSIS LOGIC ---
  let currentMode = 'original';

  function resetButtons() {
    btnOrig.className = 'modern-btn modern-btn-outline';
    btnHighlight.className = 'modern-btn modern-btn-danger';
    btnSegregate.className = 'modern-btn modern-btn-purple';
    btnHighlight.innerHTML = '&#128269; Highlight Defects';
    btnSegregate.innerHTML = '&#9986;&#65039; Segregate Defects';
    origImg.style.display = 'block';
    defCanvas.style.display = 'none';
    visualStatus.style.display = 'none';
  }

  btnOrig.onclick = () => {
    resetButtons();
    btnOrig.classList.add('active');
    currentMode = 'original';
    const dyn = document.getElementById('dynamic-analysis-stats');
    if(dyn) dyn.innerHTML = '';
  };

  function runAnalysis(mode) {
    if (currentMode === mode) return;
    resetButtons();
    currentMode = mode;
    
    const activeBtn = mode === 'highlight' ? btnHighlight : btnSegregate;
    activeBtn.innerHTML = '<span style="opacity:0.7">Processing...</span>';
    activeBtn.disabled = true;

    const W = origImg.naturalWidth;
    const H = origImg.naturalHeight;

    if (!W || !H) {
      activeBtn.innerHTML = 'Error loading image';
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = W; tempCanvas.height = H;
    const tctx = tempCanvas.getContext('2d');
    tctx.drawImage(origImg, 0, 0);
    
    const srcData = tctx.getImageData(0, 0, W, H).data;
    const totalPx = W * H;
    const step = Math.max(1, Math.floor(totalPx / 4000));

    let sumR=0, sumG=0, sumB=0, count=0;
    for (let i = 0; i < srcData.length; i += step * 4) {
      sumR += srcData[i]; sumG += srcData[i+1]; sumB += srcData[i+2]; count++;
    }
    const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;

    let varR=0, varG=0, varB=0;
    for (let i = 0; i < srcData.length; i += step * 4) {
      varR += Math.pow(srcData[i]-avgR,2); varG += Math.pow(srcData[i+1]-avgG,2); varB += Math.pow(srcData[i+2]-avgB,2);
    }
    const stdR = Math.sqrt(varR/count), stdG = Math.sqrt(varG/count), stdB = Math.sqrt(varB/count);
    const THRESH = 1.5;

    defCanvas.width = W; defCanvas.height = H;
    const dctx = defCanvas.getContext('2d');
    dctx.drawImage(origImg, 0, 0);
    const defData = dctx.getImageData(0, 0, W, H);
    const dd = defData.data;

    let anomCount = 0;
    const anomalyMask = new Uint8Array(totalPx);

    for (let px = 0; px < totalPx; px++) {
      const i = px * 4;
      const r = dd[i], g = dd[i+1], b = dd[i+2];
      const dR = Math.abs(r - avgR) / (stdR + 1);
      const dG = Math.abs(g - avgG) / (stdG + 1);
      const dB = Math.abs(b - avgB) / (stdB + 1);
      
      if (Math.max(dR, dG, dB) > THRESH) {
        anomCount++;
        anomalyMask[px] = 1;
        if (mode === 'highlight') {
          dd[i] = Math.min(255, r + 140);
          dd[i+1] = Math.max(0, Math.round(g * 0.25));
          dd[i+2] = Math.max(0, Math.round(b * 0.25));
        }
      } else {
        if (mode === 'highlight') {
          const grey = Math.round(r*0.299 + g*0.587 + b*0.114);
          const dim = Math.round(grey * 0.45);
          dd[i]=dim; dd[i+1]=dim; dd[i+2]=dim;
        } else if (mode === 'segregate') {
          dd[i+3] = 0;
        }
      }
    }
    dctx.putImageData(defData, 0, 0);

    if (mode === 'highlight') {
      const cell = Math.max(12, Math.floor(W / 24));
      dctx.strokeStyle = 'rgba(255,40,40,0.85)'; dctx.lineWidth = Math.max(1, Math.floor(W/300));
      for (let cy = 0; cy < H; cy += cell) {
        for (let cx = 0; cx < W; cx += cell) {
          let cnt=0, total=0;
          for (let dy=0; dy<cell && cy+dy<H; dy++) {
            for (let dx=0; dx<cell && cx+dx<W; dx++) {
              if (anomalyMask[(cy+dy)*W+(cx+dx)]) cnt++;
              total++;
            }
          }
          if (total > 0 && cnt/total > 0.35) dctx.strokeRect(cx+1, cy+1, Math.min(cell, W-cx)-2, Math.min(cell, H-cy)-2);
        }
      }
    }

    origImg.style.display = 'none';
    defCanvas.style.display = 'block';
    visualStatus.style.display = 'flex';
    
    const pct = ((anomCount / totalPx) * 100).toFixed(1);
    
    if (mode === 'highlight') {
      visualStatus.innerHTML = '&#128308; Highlight Mode';
      visualStatus.style.color = '#f87171';
      visualStatus.style.borderColor = 'rgba(248,113,113,0.3)';
      btnHighlight.innerHTML = '&#128269; Highlight Defects';
      btnHighlight.className = 'modern-btn modern-btn-danger active';
    } else {
      visualStatus.innerHTML = '&#9986;&#65039; Segregation Mode';
      visualStatus.style.color = '#c084fc';
      visualStatus.style.borderColor = 'rgba(192,132,252,0.3)';
      btnSegregate.innerHTML = '&#9986;&#65039; Segregate Defects';
      btnSegregate.className = 'modern-btn modern-btn-purple active';
    }
    
    activeBtn.disabled = false;

    const dyn = document.getElementById('dynamic-analysis-stats');
    if (dyn) {
      dyn.innerHTML = `
        <div class="data-card" style="background:${mode === 'highlight' ? '#fef2f2' : '#f3e8ff'}; border-color:${mode === 'highlight' ? '#fecaca' : '#e9d5ff'}; box-shadow:0 4px 12px ${mode === 'highlight' ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)'}; animation:modalFadeIn 0.3s ease;">
          <div style="font-size:0.95rem;font-weight:700;color:${mode === 'highlight' ? '#b91c1c' : '#7e22ce'};margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            ${mode === 'highlight' ? 'Local Anomaly Detection' : 'Defect Isolation Masking'}
          </div>
          <div class="data-row"><span class="data-label" style="color:#475569">Anomalous Area</span> <span class="data-value" style="color:#0f172a;font-size:1.1rem;">${pct}%</span></div>
          <div class="data-row"><span class="data-label" style="color:#475569">Color Baseline (RGB)</span> <span class="data-value" style="color:#0f172a;font-family:monospace;">${Math.round(avgR)}/${Math.round(avgG)}/${Math.round(avgB)}</span></div>
        </div>
      `;
    }
  }

  btnHighlight.onclick = () => runAnalysis('highlight');
  btnSegregate.onclick = () => runAnalysis('segregate');
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