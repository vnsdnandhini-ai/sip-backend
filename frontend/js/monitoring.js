function openMonitoringForm(id = null) {
  const point = appState.monitoringPoints.find((item) => item.id === id) || {
    name: '',
    location: '',
    frequency: '',
    description: '',
    status: 'Active',
  };

  openModal(
    id ? 'Edit Monitoring Point' : 'Add Monitoring Point',
    `<form id="monitoringForm" class="panel-form">
      <div class="form-group"><label>Name</label><input id="monitoringName" type="text" value="${point.name}" required /></div>
      <div class="form-group"><label>Location</label><input id="monitoringLocation" type="text" value="${point.location}" required /></div>
      <div class="form-group"><label>Sampling Frequency</label><input id="monitoringFrequency" type="text" value="${point.frequency}" placeholder="e.g. 15 min" required /></div>
      <div class="form-group"><label>Description</label><textarea id="monitoringDescription">${point.description}</textarea></div>
      <div class="form-group"><label>Status</label><select id="monitoringStatus"><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Review">Review</option></select></div>
    </form>`,
    id ? 'Save Changes' : 'Add Point',
    () => submitMonitoringForm(id)
  );
  document.getElementById('monitoringStatus').value = point.status;
}

function submitMonitoringForm(id) {
  const name = document.getElementById('monitoringName').value.trim();
  const location = document.getElementById('monitoringLocation').value.trim();
  const frequency = document.getElementById('monitoringFrequency').value.trim();
  const description = document.getElementById('monitoringDescription').value.trim();
  const status = document.getElementById('monitoringStatus').value;
  if (!name || !location || !frequency) {
    alert('Name, Location, and Sampling Frequency are required.');
    return;
  }
  if (id) {
    const point = appState.monitoringPoints.find((item) => item.id === id);
    Object.assign(point, { name, location, frequency, description, status });
    recordAudit('Monitoring Point Updated', 'Monitoring Point Management');
  } else {
    appState.monitoringPoints.push({ id: generateId(), name, location, frequency, description, status });
    recordAudit('Monitoring Point Added', 'Monitoring Point Management');
  }
  saveState();
  refreshMonitoringTable();
  closeModal();
}

function refreshMonitoringTable() {
  const tbody = document.querySelector('#monitoringTable tbody');
  if (!tbody) return; // Skip if element doesn't exist on this page
  tbody.innerHTML = '';
  appState.monitoringPoints.forEach((point) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${point.name}</td><td>${point.location}</td><td>${point.frequency}</td><td>${point.description}</td><td>${point.status}</td><td>${createRowActions(point.id, 'monitoring')}</td>`;
    tbody.appendChild(row);
  });
}

function deleteMonitoringPoint(id) {
  appState.monitoringPoints = appState.monitoringPoints.filter((point) => point.id !== id);
  recordAudit('Monitoring Point Deleted', 'Monitoring Point Management');
  saveState();
  refreshMonitoringTable();
}
