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
  loadState();
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
    document.getElementById('openProjectForm').addEventListener('click', openProjectForm);
  }
  if (document.getElementById('openMonitoringForm')) {
    document.getElementById('openMonitoringForm').addEventListener('click', openMonitoringForm);
  }
  if (document.getElementById('openParameterForm')) {
    document.getElementById('openParameterForm').addEventListener('click', openParameterForm);
  }
  if (document.getElementById('openConditionForm')) {
    document.getElementById('openConditionForm').addEventListener('click', openConditionForm);
  }
  if (document.getElementById('openRuleForm')) {
    document.getElementById('openRuleForm').addEventListener('click', openRuleForm);
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
    refreshDataTable();
  } else if (currentFile === 'reports.html') {
    renderReportPanel();
  } else if (currentFile === 'audit.html') {
    refreshAuditTable();
  }
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!username || !password) {
    alert('Please enter a valid username and password.');
    return;
  }

  appState.session = {
    user: username,
    token: Date.now().toString(36),
    loggedAt: new Date().toISOString(),
  };
  recordAudit('User Login', 'Login', username);
  saveState();
  window.location.href = 'dashboard.html';
}

function signOut() {
  appState.session = null;
  saveState();
  localStorage.removeItem('sipState');
  window.location.href = 'index.html';
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
        row.innerHTML = `<td>${item.parameter}</td><td>${item.instrument}</td><td>${item.value}</td><td>${item.unit}</td><td>${item.timestamp}</td><td>${item.result || 'Pending'}</td>`;
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

function recordAudit(activity, module, user = appState.session?.user || 'system') {
  const entry = {
    id: generateId(),
    timestamp: new Date().toLocaleString(),
    activity,
    module,
    user,
  };
  appState.auditTrail.unshift(entry);
  saveState();
  refreshAuditTable();
}

function openModal(title, contentHtml, onSubmitLabel, onSubmit) {
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
  if (appState.session && document.getElementById('login-form')) {
    // On login page with session - redirect to dashboard
    window.location.href = 'dashboard.html';
  } else if (!appState.session && !document.getElementById('login-form')) {
    // On module page without session - redirect to login
    window.location.href = 'index.html';
  } else {
    // Normal initialization
    initApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlatform);
} else {
  initializePlatform();
}
