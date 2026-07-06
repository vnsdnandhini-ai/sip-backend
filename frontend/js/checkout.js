function openConditionForm(id = null) {
  const condition = appState.checkoutConditions.find((item) => item.id === id) || {
    parameter: '',
    acceptance: '',
    warning: '',
    critical: '',
    action: '',
  };

  openModal(
    id ? 'Edit Checkout Condition' : 'Add Checkout Condition',
    `<form id="checkoutForm" class="panel-form">
      <div class="form-group"><label>Parameter</label><input id="conditionParameter" type="text" value="${condition.parameter}" placeholder="e.g. Moisture" required /></div>
      <div class="form-group"><label>Acceptance Limit</label><input id="conditionAcceptance" type="text" value="${condition.acceptance}" placeholder="e.g. 2-4%" required /></div>
      <div class="form-group"><label>Warning Limit</label><input id="conditionWarning" type="text" value="${condition.warning}" placeholder="e.g. 4-5%" required /></div>
      <div class="form-group"><label>Critical Limit</label><input id="conditionCritical" type="text" value="${condition.critical}" placeholder="e.g. >5%" required /></div>
      <div class="form-group"><label>Corrective Action</label><textarea id="conditionAction">${condition.action}</textarea></div>
    </form>`,
    id ? 'Save Changes' : 'Add Condition',
    () => submitConditionForm(id)
  );
}

function submitConditionForm(id) {
  const parameter = document.getElementById('conditionParameter').value.trim();
  const acceptance = document.getElementById('conditionAcceptance').value.trim();
  const warning = document.getElementById('conditionWarning').value.trim();
  const critical = document.getElementById('conditionCritical').value.trim();
  const action = document.getElementById('conditionAction').value.trim();
  if (!parameter || !acceptance || !warning || !critical) {
    alert('Parameter and all limits are required.');
    return;
  }
  if (id) {
    const condition = appState.checkoutConditions.find((item) => item.id === id);
    Object.assign(condition, { parameter, acceptance, warning, critical, action });
    recordAudit('Checkout Condition Updated', 'Checkout Condition Management');
  } else {
    appState.checkoutConditions.push({ id: generateId(), parameter, acceptance, warning, critical, action });
    recordAudit('Checkout Condition Added', 'Checkout Condition Management');
  }
  saveState();
  refreshCheckoutTable();
  closeModal();
}

function refreshCheckoutTable() {
  const tbody = document.querySelector('#checkoutTable tbody');
  if (!tbody) return; // Skip if element doesn't exist on this page
  tbody.innerHTML = '';
  appState.checkoutConditions.forEach((condition) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${condition.parameter}</td><td>${condition.acceptance}</td><td>${condition.warning}</td><td>${condition.critical}</td><td>${condition.action}</td><td>${createRowActions(condition.id, 'condition')}</td>`;
    tbody.appendChild(row);
  });
}

function deleteCheckoutCondition(id) {
  appState.checkoutConditions = appState.checkoutConditions.filter((condition) => condition.id !== id);
  recordAudit('Checkout Condition Deleted', 'Checkout Condition Management');
  saveState();
  refreshCheckoutTable();
}
