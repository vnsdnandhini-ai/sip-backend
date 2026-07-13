let monitoringPointsCache = [];

async function loadMonitoringPoints() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    monitoringPointsCache = state.monitoringPoints || [];
    appState.monitoringPoints = monitoringPointsCache;
    return monitoringPointsCache;
  } catch (err) {
    console.error('Failed to load monitoring points:', err);
    return [];
  }
}

function openMonitoringForm(id = null) {
  const point = monitoringPointsCache.find((item) => item.id === id) || {
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
      <div class="form-group"><label>Description</label><textarea id="monitoringDescription">${point.description || ''}</textarea></div>
      <div class="form-group"><label>Status</label><select id="monitoringStatus"><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Review">Review</option></select></div>
    </form>`,
    id ? 'Save Changes' : 'Add Point',
    () => submitMonitoringForm(id)
  );
  document.getElementById('monitoringStatus').value = point.status;
}

async function submitMonitoringForm(id) {
  const name = document.getElementById('monitoringName').value.trim();
  const location = document.getElementById('monitoringLocation').value.trim();
  const frequency = document.getElementById('monitoringFrequency').value.trim();
  const description = document.getElementById('monitoringDescription').value.trim();
  const status = document.getElementById('monitoringStatus').value;

  if (!name || !location || !frequency) {
    alert('Name, Location, and Sampling Frequency are required.');
    return;
  }

  try {
    if (id) {
      await fetch(`${BACKEND_URL}/api/monitoring/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location, frequency, description, status }),
      });
    } else {
      await fetch(`${BACKEND_URL}/api/monitoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location, frequency, description, status }),
      });
    }
    recordAudit(id ? 'Monitoring Point Updated' : 'Monitoring Point Added', 'Monitoring Point Management');
    closeModal();
    await refreshMonitoringTable();
  } catch (err) {
    console.error('Failed to save monitoring point:', err);
    alert('Failed to save. Check console.');
  }
}

async function deleteMonitoringPoint(id) {
  try {
    await fetch(`${BACKEND_URL}/api/monitoring/${id}`, { method: 'DELETE' });
    recordAudit('Monitoring Point Deleted', 'Monitoring Point Management');
    await refreshMonitoringTable();
  } catch (err) {
    console.error('Failed to delete monitoring point:', err);
    alert('Failed to delete. Check console.');
  }
}

function monitoringStatusBadge(status) {
  const colors = { Active: '#16a34a', Inactive: '#64748b', Review: '#d97706' };
  const color = colors[status] || '#64748b';
  return `<span style="background:${color}1a;color:${color};padding:2px 10px;border-radius:999px;font-weight:600;font-size:0.85rem;">${status}</span>`;
}

function renderMonitoringRows(points) {
  const tbody = document.querySelector('#monitoringTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (points.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">No monitoring points defined yet.</td></tr>`;
    return;
  }

  points.forEach((point) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${point.name}</td><td>${point.location}</td><td>${point.frequency}</td><td>${point.description || '-'}</td><td>${monitoringStatusBadge(point.status)}</td><td>${createRowActions(point.id, 'monitoring')}</td>`;
    tbody.appendChild(row);
  });

  const countEl = document.getElementById('monitoringResultCount');
  if (countEl) countEl.textContent = `${points.length} point${points.length !== 1 ? 's' : ''}`;
}

function applyMonitoringFilterAndSort() {
  const filterInput = document.getElementById('monitoringFilterInput');
  const statusFilter = document.getElementById('monitoringStatusFilter');
  const sortSelect = document.getElementById('monitoringSortSelect');

  let filtered = [...monitoringPointsCache];

  if (filterInput && filterInput.value.trim()) {
    const query = filterInput.value.trim().toLowerCase();
    filtered = filtered.filter((p) =>
      p.name.toLowerCase().includes(query) || p.location.toLowerCase().includes(query)
    );
  }

  if (statusFilter && statusFilter.value) {
    filtered = filtered.filter((p) => p.status === statusFilter.value);
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

  renderMonitoringRows(filtered);
}

async function refreshMonitoringTable() {
  const tbody = document.querySelector('#monitoringTable tbody');
  if (!tbody) return;

  await loadMonitoringPoints();
  applyMonitoringFilterAndSort();

  const filterInput = document.getElementById('monitoringFilterInput');
  const statusFilter = document.getElementById('monitoringStatusFilter');
  const sortSelect = document.getElementById('monitoringSortSelect');
  if (filterInput && !filterInput.dataset.bound) {
    filterInput.addEventListener('input', applyMonitoringFilterAndSort);
    filterInput.dataset.bound = 'true';
  }
  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.addEventListener('change', applyMonitoringFilterAndSort);
    statusFilter.dataset.bound = 'true';
  }
  if (sortSelect && !sortSelect.dataset.bound) {
    sortSelect.addEventListener('change', applyMonitoringFilterAndSort);
    sortSelect.dataset.bound = 'true';
  }
}
