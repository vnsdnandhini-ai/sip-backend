function openRuleForm(id = null) {
  const rule = appState.regulatoryRules.find((item) => item.id === id) || {
    name: '',
    description: '',
    status: 'Active',
  };

  openModal(
    id ? 'Edit Regulatory Rule' : 'Add Regulatory Rule',
    `<form id="ruleForm" class="panel-form">
      <div class="form-group"><label>Rule Name</label><input id="ruleName" type="text" value="${rule.name}" required /></div>
      <div class="form-group"><label>Description</label><textarea id="ruleDescription">${rule.description}</textarea></div>
      <div class="form-group"><label>Status</label><select id="ruleStatus"><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Review">Review</option></select></div>
    </form>`,
    id ? 'Save Changes' : 'Add Rule',
    () => submitRuleForm(id)
  );
  document.getElementById('ruleStatus').value = rule.status;
}

function submitRuleForm(id) {
  const name = document.getElementById('ruleName').value.trim();
  const description = document.getElementById('ruleDescription').value.trim();
  const status = document.getElementById('ruleStatus').value;
  if (!name) {
    alert('Rule Name is required for regulatory tracking.');
    return;
  }

  if (id) {
    const rule = appState.regulatoryRules.find((item) => item.id === id);
    Object.assign(rule, { name, description, status });
    recordAudit('Regulatory Rule Updated', 'Regulatory Rule Management');
  } else {
    appState.regulatoryRules.push({ id: generateId(), name, description, status });
    recordAudit('Regulatory Rule Added', 'Regulatory Rule Management');
  }

  saveState();
  refreshRulesTable();
  closeModal();
}

function refreshRulesTable() {
  const tbody = document.querySelector('#rulesTable tbody');
  if (!tbody) return; // Skip if element doesn't exist on this page
  tbody.innerHTML = '';
  appState.regulatoryRules.forEach((rule) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${rule.name}</td><td>${rule.description}</td><td>${rule.status}</td><td>${createRowActions(rule.id, 'rule')}</td>`;
    tbody.appendChild(row);
  });
}

function deleteRegulatoryRule(id) {
  appState.regulatoryRules = appState.regulatoryRules.filter((rule) => rule.id !== id);
  recordAudit('Regulatory Rule Deleted', 'Regulatory Rule Management');
  saveState();
  refreshRulesTable();
}
