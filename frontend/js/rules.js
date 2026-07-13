let regulatoryRulesCache = [];

async function loadRegulatoryRules() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    regulatoryRulesCache = state.regulatoryRules || [];
    appState.regulatoryRules = regulatoryRulesCache;
    return regulatoryRulesCache;
  } catch (err) {
    console.error('Failed to load regulatory rules:', err);
    return [];
  }
}

function openRuleForm(id = null) {
  const rule = regulatoryRulesCache.find((item) => item.id === id) || {
    name: '',
    description: '',
    status: 'Active',
  };
  openModal(
    id ? 'Edit Regulatory Rule' : 'Add Regulatory Rule',
    `<form id="ruleForm" class="panel-form">
      <div class="form-group"><label>Rule Name</label><input id="ruleName" type="text" value="${rule.name}" required /></div>
      <div class="form-group"><label>Description</label><textarea id="ruleDescription">${rule.description || ''}</textarea></div>
      <div class="form-group"><label>Status</label><select id="ruleStatus"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
    </form>`,
    id ? 'Save Changes' : 'Add Rule',
    () => submitRuleForm(id)
  );
  document.getElementById('ruleStatus').value = rule.status;
}

async function submitRuleForm(id) {
  const name = document.getElementById('ruleName').value.trim();
  const description = document.getElementById('ruleDescription').value.trim();
  const status = document.getElementById('ruleStatus').value;

  if (!name) {
    alert('Rule Name is required.');
    return;
  }

  try {
    if (id) {
      await fetch(`${BACKEND_URL}/api/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, status }),
      });
    } else {
      await fetch(`${BACKEND_URL}/api/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, status }),
      });
    }
    recordAudit(id ? 'Regulatory Rule Updated' : 'Regulatory Rule Added', 'Regulatory Rule Management');
    closeModal();
    await refreshRulesTable();
  } catch (err) {
    console.error('Failed to save rule:', err);
    alert('Failed to save. Check console.');
  }
}

async function deleteRegulatoryRule(id) {
  try {
    await fetch(`${BACKEND_URL}/api/rules/${id}`, { method: 'DELETE' });
    recordAudit('Regulatory Rule Deleted', 'Regulatory Rule Management');
    await refreshRulesTable();
  } catch (err) {
    console.error('Failed to delete rule:', err);
    alert('Failed to delete. Check console.');
  }
}

function ruleStatusBadge(status) {
  const color = status === 'Active' ? '#16a34a' : '#64748b';
  return `<span style="background:${color}1a;color:${color};padding:2px 10px;border-radius:999px;font-weight:600;font-size:0.85rem;">${status}</span>`;
}

function renderRulesRows(rules) {
  const tbody = document.querySelector('#rulesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (rules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">No regulatory rules defined yet.</td></tr>`;
    return;
  }

  rules.forEach((rule) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${rule.name}</td><td>${rule.description || '-'}</td><td>${ruleStatusBadge(rule.status)}</td><td>${createRowActions(rule.id, 'rule')}</td>`;
    tbody.appendChild(row);
  });

  const countEl = document.getElementById('rulesResultCount');
  if (countEl) countEl.textContent = `${rules.length} rule${rules.length !== 1 ? 's' : ''}`;
}

function applyRulesFilterAndSort() {
  const filterInput = document.getElementById('rulesFilterInput');
  const statusFilter = document.getElementById('rulesStatusFilter');

  let filtered = [...regulatoryRulesCache];

  if (filterInput && filterInput.value.trim()) {
    const query = filterInput.value.trim().toLowerCase();
    filtered = filtered.filter((r) =>
      r.name.toLowerCase().includes(query) || (r.description || '').toLowerCase().includes(query)
    );
  }

  if (statusFilter && statusFilter.value) {
    filtered = filtered.filter((r) => r.status === statusFilter.value);
  }

  renderRulesRows(filtered);
}

async function refreshRulesTable() {
  const tbody = document.querySelector('#rulesTable tbody');
  if (!tbody) return;

  await loadRegulatoryRules();
  applyRulesFilterAndSort();

  const filterInput = document.getElementById('rulesFilterInput');
  const statusFilter = document.getElementById('rulesStatusFilter');
  if (filterInput && !filterInput.dataset.bound) {
    filterInput.addEventListener('input', applyRulesFilterAndSort);
    filterInput.dataset.bound = 'true';
  }
  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.addEventListener('change', applyRulesFilterAndSort);
    statusFilter.dataset.bound = 'true';
  }
}
