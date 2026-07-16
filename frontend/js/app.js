const BACKEND_URL = 'https://sip-backend-1.onrender.com';

async function fetchLiveAnalyticalData() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const liveData = await response.json();
    if (liveData.analyticalData && liveData.analyticalData.length) {
      const liveFormatted = liveData.analyticalData.map((item) => ({
        id: item.id,
        parameter: item.parameters ? Object.keys(item.parameters).join(', ') : (item.readingType || 'Sensor Reading'),
        instrument: item.deviceId || 'ESP32',
        value: item.parameters ? Object.values(item.parameters).join(' / ') : '',
        unit: '',
         timestamp: item.receivedAt,
        result: 'Live',
        isLive: true,
      }));
    appState.analyticalData = [...liveFormatted.reverse(), ...appState.analyticalData];
    }
  } catch (err) {
    console.error('Could not fetch live sensor data:', err);
  }
}
async function refreshDataTable() {
  await fetchLiveAnalyticalData();
  searchTable('dataTable', appState.analyticalData, ['parameter', 'instrument', 'value', 'unit', 'timestamp', 'result'], '');
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
  alert('CSV upload is not yet connected to the backend. Please use sensor ingestion or contact the developer to enable this feature.');
}
async function deleteSingleReading(id) {
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
    searchTable('dataTable', appState.analyticalData, ['parameter', 'instrument', 'value', 'unit', 'timestamp', 'result'], query);
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
        row.innerHTML = `<td>${item.parameter}</td><td>${item.instrument}</td><td>${item.value}</td><td>${item.unit}</td><td>${item.timestamp}</td><td>${item.result || 'Pending'}</td><td>${deleteBtn}</td>`;
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
    fetchLiveAnalyticalData().then(() => {
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