let checkoutConditionsCache = [];
let monitoringPointsForDropdown = [];
let regulatoryRulesForDropdown = [];

async function loadCheckoutConditions() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    checkoutConditionsCache = state.checkoutConditions || [];
    monitoringPointsForDropdown = state.monitoringPoints || [];
    regulatoryRulesForDropdown = state.regulatoryRules || [];
    appState.checkoutConditions = checkoutConditionsCache;
    return checkoutConditionsCache;
  } catch (err) {
    console.error('Failed to load checkout conditions:', err);
    return [];
  }
}

function openConditionForm(id = null) {
  const condition = checkoutConditionsCache.find((item) => item.id === id) || {
    parameter: '',
    acceptance: '',
    warning: '',
    critical: '',
    action: '',
    monitoringPointId: '',
    regulatoryRuleId: '',
  };

  const monitoringPointOptions = monitoringPointsForDropdown
    .map((mp) => `<option value="${mp.id}" ${condition.monitoringPointId === mp.id ? 'selected' : ''}>${mp.name}</option>`)
    .join('');

  const regulatoryRuleOptions = regulatoryRulesForDropdown
    .map((r) => `<option value="${r.id}" ${condition.regulatoryRuleId === r.id ? 'selected' : ''}>${r.name}</option>`)
    .join('');

  openModal(
    id ? 'Edit Checkout Condition' : 'Add Checkout Condition',
    `<form id="checkoutForm" class="panel-form">
      <div class="form-group"><label>Parameter</label><input id="conditionParameter" type="text" value="${condition.parameter}" placeholder="e.g. concentration" required/></div>
      <div class="form-group">
        <label>Monitoring Point (optional - leave blank to apply globally)</label>
        <select id="conditionMonitoringPoint">
          <option value="">Global (applies to all monitoring points)</option>
          ${monitoringPointOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Regulatory Basis (optional)</label>
        <select id="conditionRegulatoryRule">
          <option value="">No specific rule linked</option>
          ${regulatoryRuleOptions}
        </select>
      </div>
      <div class="form-group"><label>Acceptance Limit</label><input id="conditionAcceptance" type="text" value="${condition.acceptance}" placeholder="e.g. 8-15" required /></div>
      <div class="form-group"><label>Warning Limit</label><input id="conditionWarning" type="text" value="${condition.warning}" placeholder="e.g. 5-8" required /></div>
      <div class="form-group"><label>Critical Limit</label><input id="conditionCritical" type="text" value="${condition.critical}" placeholder="e.g. <5" required /></div>
      <div class="form-group"><label>Corrective Action</label><textarea id="conditionAction">${condition.action || ''}</textarea></div>
    </form>`,
    id ? 'Save Changes' : 'Add Condition',
    () => submitConditionForm(id)
  );
}
async function submitConditionForm(id) {
  const parameter = document.getElementById('conditionParameter').value.trim();
  const monitoringPointId = document.getElementById('conditionMonitoringPoint').value;
  const regulatoryRuleId = document.getElementById('conditionRegulatoryRule').value;
  const acceptance = document.getElementById('conditionAcceptance').value.trim();
  const warning = document.getElementById('conditionWarning').value.trim();
  const critical = document.getElementById('conditionCritical').value.trim();
  const action = document.getElementById('conditionAction').value.trim();

  if (!parameter || !acceptance || !warning || !critical) {
    alert('Parameter and all limits are required.');
    return;
  }

  const payload = { parameter, acceptance, warning, critical, action, monitoringPointId: monitoringPointId || null, regulatoryRuleId: regulatoryRuleId || null };

  try {
    if (id) {
      await fetch(`${BACKEND_URL}/api/conditions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${BACKEND_URL}/api/conditions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    recordAudit(id ? 'Checkout Condition Updated' : 'Checkout Condition Added', 'Checkout Condition Management');
    closeModal();
    await refreshCheckoutTable();
  } catch (err) {
    console.error('Failed to save condition:', err);
    alert('Failed to save. Check console.');
  }
}

async function deleteCheckoutCondition(id) {
  try {
    await fetch(`${BACKEND_URL}/api/conditions/${id}`, { method: 'DELETE' });
    recordAudit('Checkout Condition Deleted', 'Checkout Condition Management');
    await refreshCheckoutTable();
  } catch (err) {
    console.error('Failed to delete condition:', err);
    alert('Failed to delete. Check console.');
  }
}

async function duplicateCondition(id) {
  const original = checkoutConditionsCache.find((c) => c.id === id);
  if (!original) return;

  try {
    await fetch(`${BACKEND_URL}/api/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parameter: `${original.parameter} (copy)`,
        acceptance: original.acceptance,
        warning: original.warning,
        critical: original.critical,
        action: original.action,
        monitoringPointId: original.monitoringPointId || null,
      }),
    });
    await refreshCheckoutTable();
  } catch (err) {
    console.error('Failed to duplicate condition:', err);
    alert('Failed to duplicate. Check console.');
  }
}

function exportConditionsToCsv() {
  const rows = [['Parameter', 'Monitoring Point', 'Acceptance', 'Warning', 'Critical', 'Corrective Action']];
  checkoutConditionsCache.forEach((c) => {
    const mpName = monitoringPointsForDropdown.find((mp) => mp.id === c.monitoringPointId)?.name || 'Global';
    rows.push([c.parameter, mpName, c.acceptance, c.warning, c.critical, c.action || '']);
  });
  const csvContent = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'checkout-conditions.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseConditionStringClient(str) {
  if (!str) return null;
  const cleaned = String(str).trim().replace(/[%µunitsAUpH]+$/i, '').trim();
  const rangeMatch = cleaned.match(/^(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)$/);
  if (rangeMatch) return { type: 'range', min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  const lteMatch = cleaned.match(/^<=\s*(-?\d+\.?\d*)$/);
  if (lteMatch) return { type: 'lte', bound: parseFloat(lteMatch[1]) };
  const gteMatch = cleaned.match(/^>=\s*(-?\d+\.?\d*)$/);
  if (gteMatch) return { type: 'gte', bound: parseFloat(gteMatch[1]) };
  const ltMatch = cleaned.match(/^<\s*(-?\d+\.?\d*)$/);
  if (ltMatch) return { type: 'lt', bound: parseFloat(ltMatch[1]) };
  const gtMatch = cleaned.match(/^>\s*(-?\d+\.?\d*)$/);
  if (gtMatch) return { type: 'gt', bound: parseFloat(gtMatch[1]) };
  return null;
}

function valueSatisfiesClient(value, parsed) {
  if (!parsed) return null;
  if (parsed.type === 'range') return value >= parsed.min && value <= parsed.max;
  if (parsed.type === 'lt') return value < parsed.bound;
  if (parsed.type === 'lte') return value <= parsed.bound;
  if (parsed.type === 'gt') return value > parsed.bound;
  if (parsed.type === 'gte') return value >= parsed.bound;
  return null;
}

function runTestValue() {
  const paramSelect = document.getElementById('testValueParameter');
  const valueInput = document.getElementById('testValueInput');
  const resultEl = document.getElementById('testValueResult');

  const condition = checkoutConditionsCache.find((c) => c.id === paramSelect.value);
  const value = parseFloat(valueInput.value);

  if (!condition) {
    resultEl.innerHTML = `<span style="color:#dc2626;">Select a parameter first.</span>`;
    return;
  }
  if (Number.isNaN(value)) {
    resultEl.innerHTML = `<span style="color:#dc2626;">Enter a valid number.</span>`;
    return;
  }

  const acceptance = parseConditionStringClient(condition.acceptance);
  const warning = parseConditionStringClient(condition.warning);
  const critical = parseConditionStringClient(condition.critical);

  let result, color;
  if (valueSatisfiesClient(value, acceptance)) {
    result = 'PASS'; color = '#16a34a';
  } else if (valueSatisfiesClient(value, critical)) {
    result = 'CRITICAL'; color = '#dc2626';
  } else if (valueSatisfiesClient(value, warning)) {
    result = 'WARNING'; color = '#d97706';
  } else {
    result = 'OUT OF DEFINED RANGE'; color = '#64748b';
  }

  resultEl.innerHTML = `<span style="background:${color}1a;color:${color};padding:4px 12px;border-radius:999px;font-weight:600;">${result}</span>`;
}

function populateTestValueDropdown() {
  const select = document.getElementById('testValueParameter');
  if (!select) return;
  select.innerHTML = checkoutConditionsCache
    .map((c) => `<option value="${c.id}">${c.parameter}</option>`)
    .join('');
}

function renderCheckoutRows(conditions) {
  const tbody = document.querySelector('#checkoutTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (conditions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">No checkout conditions defined yet.</td></tr>`;
    return;
  }

  conditions.forEach((condition) => {
    const mpName = monitoringPointsForDropdown.find((mp) => mp.id === condition.monitoringPointId)?.name;
    const mpBadge = mpName
      ? `<span style="background:#2563eb1a;color:#2563eb;padding:2px 10px;border-radius:999px;font-size:0.8rem;">${mpName}</span>`
      : `<span style="color:#94a3b8;font-size:0.8rem;">Global</span>`;

    const ruleName = regulatoryRulesForDropdown.find((r) => r.id === condition.regulatoryRuleId)?.name;
    const ruleBadge = ruleName
      ? `<span style="background:#7c3aed1a;color:#7c3aed;padding:2px 10px;border-radius:999px;font-size:0.8rem;">${ruleName}</span>`
      : `<span style="color:#94a3b8;font-size:0.8rem;">-</span>`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${condition.parameter}</td>
      <td>${mpBadge}</td>
      <td>${ruleBadge}</td>
      <td>${condition.acceptance}</td>
      <td>${condition.warning}</td>
      <td>${condition.critical}</td>
      <td>${condition.action || '-'}</td>
      <td>
        ${createRowActions(condition.id, 'condition')}
        <button class="table-action-button" onclick="duplicateCondition('${condition.id}')">Duplicate</button>
      </td>`;
    tbody.appendChild(row);
  });

  const countEl = document.getElementById('checkoutResultCount');
  if (countEl) countEl.textContent = `${conditions.length} condition${conditions.length !== 1 ? 's' : ''}`;
}

function applyCheckoutFilterAndSort() {
  const filterInput = document.getElementById('checkoutFilterInput');
  const sortSelect = document.getElementById('checkoutSortSelect');

  let filtered = [...checkoutConditionsCache];

  if (filterInput && filterInput.value.trim()) {
    const query = filterInput.value.trim().toLowerCase();
    filtered = filtered.filter((c) =>
      c.parameter.toLowerCase().includes(query) ||
      c.acceptance.toLowerCase().includes(query) ||
      c.warning.toLowerCase().includes(query) ||
      c.critical.toLowerCase().includes(query) ||
      (c.action || '').toLowerCase().includes(query)
    );
  }

  if (sortSelect) {
    const [field, direction] = sortSelect.value.split('-');
    filtered.sort((a, b) => {
      const valA = String(a[field] || '').toLowerCase();
      const valB = String(b[field] || '').toLowerCase();
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  renderCheckoutRows(filtered);
}

async function refreshCheckoutTable() {
  const tbody = document.querySelector('#checkoutTable tbody');
  if (!tbody) return;

  await loadCheckoutConditions();
  applyCheckoutFilterAndSort();
  populateTestValueDropdown();

  const filterInput = document.getElementById('checkoutFilterInput');
  const sortSelect = document.getElementById('checkoutSortSelect');
  const exportBtn = document.getElementById('exportConditionsCsv');
  const testBtn = document.getElementById('runTestValue');

  if (filterInput && !filterInput.dataset.bound) {
    filterInput.addEventListener('input', applyCheckoutFilterAndSort);
    filterInput.dataset.bound = 'true';
  }
  if (sortSelect && !sortSelect.dataset.bound) {
    sortSelect.addEventListener('change', applyCheckoutFilterAndSort);
    sortSelect.dataset.bound = 'true';
  }
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.addEventListener('click', exportConditionsToCsv);
    exportBtn.dataset.bound = 'true';
  }
  if (testBtn && !testBtn.dataset.bound) {
    testBtn.addEventListener('click', runTestValue);
    testBtn.dataset.bound = 'true';
  }
}
