function openParameterForm(id = null) {
  const parameter = appState.parameters.find((item) => item.id === id) || {
    name: '',
    instrument: '',
    unit: '',
    frequency: '',
    description: '',
  };

  openModal(
    id ? 'Edit Process Parameter' : 'Add Process Parameter',
    `<form id="parameterForm" class="panel-form">
      <div class="form-group"><label>Parameter Name</label><input id="parameterName" type="text" value="${parameter.name}" required /></div>
      <div class="form-group"><label>Instrument</label><input id="parameterInstrument" type="text" value="${parameter.instrument}" required /></div>
      <div class="form-group"><label>Unit</label><input id="parameterUnit" type="text" value="${parameter.unit}" required /></div>
      <div class="form-group"><label>Sampling Frequency</label><input id="parameterFrequency" type="text" value="${parameter.frequency}" placeholder="e.g. 30 sec" required /></div>
      <div class="form-group"><label>Description</label><textarea id="parameterDescription">${parameter.description}</textarea></div>
    </form>`,
    id ? 'Save Changes' : 'Add Parameter',
    () => submitParameterForm(id)
  );
}

function submitParameterForm(id) {
  const name = document.getElementById('parameterName').value.trim();
  const instrument = document.getElementById('parameterInstrument').value.trim();
  const unit = document.getElementById('parameterUnit').value.trim();
  const frequency = document.getElementById('parameterFrequency').value.trim();
  const description = document.getElementById('parameterDescription').value.trim();
  if (!name || !instrument || !unit || !frequency) {
    alert('Parameter Name, Instrument, Unit, and Sampling Frequency are required.');
    return;
  }
  if (id) {
    const parameter = appState.parameters.find((item) => item.id === id);
    Object.assign(parameter, { name, instrument, unit, frequency, description });
    recordAudit('Process Parameter Updated', 'Process Parameter Management');
  } else {
    appState.parameters.push({ id: generateId(), name, instrument, unit, frequency, description });
    recordAudit('Process Parameter Added', 'Process Parameter Management');
  }
  saveState();
  refreshParametersTable();
  refreshDataParameterOptions();
  closeModal();
}

function refreshParametersTable() {
  const tbody = document.querySelector('#parametersTable tbody');
  if (!tbody) return; // Skip if element doesn't exist on this page
  tbody.innerHTML = '';
  appState.parameters.forEach((parameter) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${parameter.name}</td><td>${parameter.instrument}</td><td>${parameter.unit}</td><td>${parameter.frequency}</td><td>${parameter.description}</td><td>${createRowActions(parameter.id, 'parameter')}</td>`;
    tbody.appendChild(row);
  });
}

function deleteParameter(id) {
  appState.parameters = appState.parameters.filter((parameter) => parameter.id !== id);
  recordAudit('Process Parameter Deleted', 'Process Parameter Management');
  saveState();
  refreshParametersTable();
  refreshDataParameterOptions();
}
