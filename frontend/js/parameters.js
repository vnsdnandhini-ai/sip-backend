let parametersCache = [];
let monitoringPointsForDropdown = [];

async function loadParameters() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    parametersCache = state.parameters || [];
    monitoringPointsForDropdown = state.monitoringPoints || [];
    appState.parameters = parametersCache;
    return parametersCache;
  } catch (err) {
    console.error('Failed to load parameters:', err);
    return [];
  }
}

function openParameterForm(id = null) {
  const parameter = parametersCache.find((item) => item.id === id) || {
    name: '',
    instrument: '',
    unit: '',
    frequency: '',
    description: '',
    monitoringPointId: '',
  };

  const monitoringPointOptions = monitoringPointsForDropdown
    .map((mp) => `<option value="${mp.id}" ${parameter.monitoringPointId === mp.id ? 'selected' : ''}>${mp.name}</option>`)
    .join('');

  openModal(
    id ? 'Edit Process Parameter' : 'Add Process Parameter',
    `<form id="parameterForm" class="panel-form">
      <div class="form-group"><label>Parameter Name</label><input id="parameterName" type="text" value="${parameter.name}" required /></div>
      <div class="form-group">
        <label>Monitoring Point (optional - leave blank to apply globally)</label>
        <select id="parameterMonitoringPoint">
          <option value="">Global (applies to all monitoring points)</option>
          ${monitoringPointOptions}
        </select>
      </div>
      <div class="form-group"><label>Instrument</label><input id="parameterInstrument" type="text" value="${parameter.instrument}" required /></div>
      <div class="form-group"><label>Unit</label><input id="parameterUnit" type="text" value="${parameter.unit}" required /></div>
      <div class="form-group"><label>Sampling Frequency</label><input id="parameterFrequency" type="text" value="${parameter.frequency}" placeholder="e.g. 30 sec" required /></div>
      <div class="form-group"><label>Description</label><textarea id="parameterDescription">${parameter.description || ''}</textarea></div>
    </form>`,
    id ? 'Save Changes' : 'Add Parameter',
    () => submitParameterForm(id)
  );
}

async function submitParameterForm(id) {
  const name = document.getElementById('parameterName').value.trim();
  const monitoringPointId = document.getElementById('parameterMonitoringPoint').value;
  const instrument = document.getElementById('parameterInstrument').value.trim();
  const unit = document.getElementById('parameterUnit').value.trim();
  const frequency = document.getElementById('parameterFrequency').value.trim();
  const description = document.getElementById('parameterDescription').value.trim();

  if (!name || !instrument || !unit || !frequency) {
    alert('Parameter Name, Instrument, Unit, and Sampling Frequency are required.');
    return;
  }

  const payload = { name, instrument, unit, frequency, description, monitoringPointId: monitoringPointId || null };

  try {
    if (id) {
      await fetch(`${BACKEND_URL}/api/parameters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${BACKEND_URL}/api/parameters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    recordAudit(id ? 'Process Parameter Updated' : 'Process Parameter Added', 'Process Parameter Management');
    closeModal();
    await refreshParametersTable();
  } catch (err) {
    console.error('Failed to save parameter:', err);
    alert('Failed to save. Check console.');
  }
}

async function deleteParameter(id) {
  try {
    await fetch(`${BACKEND_URL}/api/parameters/${id}`, { method: 'DELETE' });
    recordAudit('Process Parameter Deleted', 'Process Parameter Management');
    await refreshParametersTable();
  } catch (err) {
    console.error('Failed to delete parameter:', err);
    alert('Failed to delete. Check console.');
  }
}

function renderParametersRows(parameters) {
  const tbody = document.querySelector('#parametersTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (parameters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">No parameters defined yet.</td></tr>`;
    return;
  }

  parameters.forEach((parameter) => {
    const mpName = monitoringPointsForDropdown.find((mp) => mp.id === parameter.monitoringPointId)?.name;
    const mpBadge = mpName
      ? `<span style="background:#2563eb1a;color:#2563eb;padding:2px 10px;border-radius:999px;font-size:0.8rem;">${mpName}</span>`
      : `<span style="color:#94a3b8;font-size:0.8rem;">Global</span>`;

    const row = document.createElement('tr');
    row.innerHTML = `<td>${parameter.name}</td><td>${mpBadge}</td><td>${parameter.instrument}</td><td>${parameter.unit}</td><td>${parameter.frequency}</td><td>${parameter.description || '-'}</td><td>${createRowActions(parameter.id, 'parameter')}</td>`;
    tbody.appendChild(row);
  });

  const countEl = document.getElementById('parametersResultCount');
  if (countEl) countEl.textContent = `${parameters.length} parameter${parameters.length !== 1 ? 's' : ''}`;
}

function applyParametersFilterAndSort() {
  const filterInput = document.getElementById('parametersFilterInput');
  const sortSelect = document.getElementById('parametersSortSelect');

  let filtered = [...parametersCache];

  if (filterInput && filterInput.value.trim()) {
    const query = filterInput.value.trim().toLowerCase();
    filtered = filtered.filter((p) =>
      p.name.toLowerCase().includes(query) || p.instrument.toLowerCase().includes(query)
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

  renderParametersRows(filtered);
}

async function refreshParametersTable() {
  const tbody = document.querySelector('#parametersTable tbody');
  if (!tbody) return;

  await loadParameters();
  applyParametersFilterAndSort();

  const filterInput = document.getElementById('parametersFilterInput');
  const sortSelect = document.getElementById('parametersSortSelect');
  if (filterInput && !filterInput.dataset.bound) {
    filterInput.addEventListener('input', applyParametersFilterAndSort);
    filterInput.dataset.bound = 'true';
  }
  if (sortSelect && !sortSelect.dataset.bound) {
    sortSelect.addEventListener('change', applyParametersFilterAndSort);
    sortSelect.dataset.bound = 'true';
  }
}
