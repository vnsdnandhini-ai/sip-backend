// Spectroscopic Intelligence Platform - Batch Management Controller
let batchesCache = [];

async function loadBatches() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    batchesCache = state.batches || state.projects || [];
    appState.batches = batchesCache;
    appState.projects = batchesCache;
    return batchesCache;
  } catch (err) {
    console.error('Failed to load batches:', err);
    return [];
  }
}

function openBatchForm(id = null) {
  const batch = batchesCache.find((item) => item.id === id) || {
    name: '',
    product: '',
    batchNumber: '',
    materialId: '',
    materialName: '',
    supplier: '',
    targetQuantity: '',
    actualQuantity: '',
    department: 'Solid Dosage Formulation',
    line: 'Line-1 (High Shear Granulation)',
    currentStage: 'Raw Material Receipt',
    status: 'Active',
    notes: '',
  };

  const stages = [
    'Raw Material Receipt',
    'Dispensing',
    'Blending',
    'Granulation',
    'Drying',
    'Final Blending',
    'Compression',
    'Final QC'
  ];

  const stageOptions = stages.map(s => 
    `<option value="${s}" ${batch.currentStage === s ? 'selected' : ''}>${s}</option>`
  ).join('');

  openModal(
    id ? 'Edit Pharmaceutical Batch' : 'Register New Manufacturing Batch',
    `<form id="batchForm" class="panel-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 14px;">
      <div class="form-group" style="grid-column: 1/-1;">
        <label>Batch Name *</label>
        <input id="batchName" type="text" placeholder="e.g. Paracetamol 500mg - Batch Alpha" value="${batch.name || ''}" required />
      </div>
      <div class="form-group">
        <label>Product Name / Formulation *</label>
        <input id="productName" type="text" placeholder="e.g. Paracetamol Tablet USP 500mg" value="${batch.product || ''}" required />
      </div>
      <div class="form-group">
        <label>Batch / Lot Number *</label>
        <input id="batchNumber" type="text" placeholder="e.g. BATCH-2026-0908" value="${batch.batchNumber || ''}" required />
      </div>
      <div class="form-group">
        <label>Raw Material ID</label>
        <input id="materialId" type="text" placeholder="e.g. RM-API-0042" value="${batch.materialId || ''}" />
      </div>
      <div class="form-group">
        <label>Raw Material Name / API</label>
        <input id="materialName" type="text" placeholder="e.g. Tulsi / Acetaminophen Pure" value="${batch.materialName || ''}" />
      </div>
      <div class="form-group">
        <label>Approved Supplier</label>
        <input id="supplier" type="text" placeholder="e.g. Apex Pharma Botanicals Inc." value="${batch.supplier || ''}" />
      </div>
      <div class="form-group">
        <label>Target Quantity (kg)</label>
        <input id="targetQuantity" type="number" step="0.01" placeholder="e.g. 50.00" value="${batch.targetQuantity !== null && batch.targetQuantity !== undefined ? batch.targetQuantity : ''}" />
      </div>
      <div class="form-group">
        <label>Department</label>
        <input id="department" type="text" value="${batch.department || 'Solid Oral Dosage'}" />
      </div>
      <div class="form-group">
        <label>Manufacturing Line</label>
        <input id="line" type="text" value="${batch.line || 'Line 1 - Granulation & Tablet Press'}" />
      </div>
      <div class="form-group">
        <label>Current Process Stage</label>
        <select id="currentStage">${stageOptions}</select>
      </div>
      <div class="form-group">
        <label>Batch Lifecycle Status</label>
        <select id="status">
          <option value="Active" ${batch.status === 'Active' ? 'selected' : ''}>Active</option>
          <option value="Completed" ${batch.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Paused" ${batch.status === 'Paused' ? 'selected' : ''}>Paused</option>
        </select>
      </div>
      <div class="form-group" style="grid-column: 1/-1;">
        <label>Batch Notes / QC Protocol</label>
        <textarea id="notes" rows="2" placeholder="e.g. Executing under SOP-QA-401 for NIR spectroscopic release.">${batch.notes || ''}</textarea>
      </div>
    </form>`,
    id ? 'Save Changes' : 'Register Batch',
    () => submitBatchForm(id)
  );
}

async function submitBatchForm(id) {
  const name = document.getElementById('batchName').value.trim();
  const product = document.getElementById('productName').value.trim();
  const batchNumber = document.getElementById('batchNumber').value.trim();
  const materialId = document.getElementById('materialId').value.trim();
  const materialName = document.getElementById('materialName').value.trim();
  const supplier = document.getElementById('supplier').value.trim();
  const targetQuantity = document.getElementById('targetQuantity').value.trim();
  const department = document.getElementById('department').value.trim();
  const line = document.getElementById('line').value.trim();
  const currentStage = document.getElementById('currentStage').value;
  const status = document.getElementById('status').value;
  const notes = document.getElementById('notes').value.trim();

  if (!name || !product || !batchNumber) {
    alert('Batch Name, Product Name, and Batch Number are required.');
    return;
  }

  const payload = {
    name, product, batchNumber, materialId, materialName, supplier,
    targetQuantity: targetQuantity ? parseFloat(targetQuantity) : null,
    department, line, currentStage, status, notes
  };

  try {
    let res;
    if (id) {
      res = await fetch(`${BACKEND_URL}/api/batches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`${BACKEND_URL}/api/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      throw new Error(`Failed to save: HTTP ${res.status}`);
    }

    recordAudit(id ? `Batch Updated: ${batchNumber}` : `Batch Registered: ${batchNumber}`, 'Batch Management');
    closeModal();
    await refreshBatchTable();

    const continueBtn = document.getElementById("continueMonitoringBtn");
    if (continueBtn) {
      continueBtn.disabled = false;
    }
  } catch (err) {
    console.error('Failed to save batch:', err);
    alert('Failed to save batch record. Check console for details.');
  }
}

async function deleteBatch(id) {
  if (!confirm('Are you sure you want to delete this batch record? All linked quality logs will be affected.')) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/batches/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    recordAudit('Batch Deleted', 'Batch Management');
    await refreshBatchTable();
  } catch (err) {
    console.error('Failed to delete batch:', err);
    alert('Failed to delete batch. Check console.');
  }
}

function statusBadge(status) {
  const colors = { Active: '#16a34a', Completed: '#2563eb', Paused: '#d97706' };
  const color = colors[status] || '#64748b';
  return `<span style="background:${color}1a;color:${color};border:1px solid ${color}40;padding:3px 10px;border-radius:999px;font-weight:600;font-size:0.8rem;">${status}</span>`;
}

function stageBadge(stage) {
  return `<span style="background:rgba(99,102,241,0.12);color:#4f46e5;border:1px solid rgba(99,102,241,0.25);padding:3px 10px;border-radius:999px;font-weight:600;font-size:0.8rem;white-space:nowrap;">📍 ${stage || 'Raw Material Receipt'}</span>`;
}

function renderBatchRows(batches) {
  const tbody = document.querySelector('#batchesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (batches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:30px;">No pharmaceutical batches found. Click "Create Batch" to start.</td></tr>`;
    return;
  }

  batches.forEach((batch) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <strong>${batch.name}</strong>
        ${batch.materialName ? `<div style="font-size:0.75rem;color:#64748b;">Material: ${batch.materialName} (${batch.materialId || '-'})</div>` : ''}
      </td>
      <td>${batch.product}</td>
      <td><span style="font-family:monospace;font-weight:600;color:#0f172a;">${batch.batchNumber}</span></td>
      <td>${stageBadge(batch.currentStage)}</td>
      <td>${batch.department || '-'} / ${batch.line || '-'}</td>
      <td>${statusBadge(batch.status)}</td>
      <td style="white-space:nowrap;">
        <button class="button button--primary" style="padding:4px 10px;font-size:0.8rem;margin-right:6px;" onclick="localStorage.setItem('sipActiveBatchId', '${batch.id}'); window.location.href='manufacturing-process.html?id=${batch.id}'">
          8-Step Studio ➔
        </button>
        <button class="button button--secondary" style="padding:4px 10px;font-size:0.8rem;margin-right:6px;" onclick="localStorage.setItem('sipActiveBatchId', '${batch.id}'); window.location.href='batch-details.html?id=${batch.id}'">
          Passport
        </button>
        <button class="table-action-button" onclick="openBatchForm('${batch.id}')" title="Edit Batch">&#9998;</button>
        <button class="table-action-button danger" onclick="deleteBatch('${batch.id}')" title="Delete Batch">&#128465;</button>
      </td>

    `;
    tbody.appendChild(row);
  });

  const countEl = document.getElementById('batchesResultCount');
  if (countEl) countEl.textContent = `${batches.length} batch${batches.length !== 1 ? 's' : ''}`;
}

function applyBatchesFilterAndSort() {
  const filterInput = document.getElementById('batchesFilterInput');
  const statusFilter = document.getElementById('batchesStatusFilter');
  const sortSelect = document.getElementById('batchesSortSelect');

  let filtered = [...batchesCache];

  if (filterInput && filterInput.value.trim()) {
    const query = filterInput.value.trim().toLowerCase();
    filtered = filtered.filter((p) =>
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.product && p.product.toLowerCase().includes(query)) ||
      (p.batchNumber && p.batchNumber.toLowerCase().includes(query)) ||
      (p.materialName && p.materialName.toLowerCase().includes(query)) ||
      (p.materialId && p.materialId.toLowerCase().includes(query))
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

  renderBatchRows(filtered);
}

async function refreshBatchTable() {
  const tbody = document.querySelector('#batchesTable tbody');
  if (!tbody) return;

  await loadBatches();
  applyBatchesFilterAndSort();

  const filterInput = document.getElementById('batchesFilterInput');
  const statusFilter = document.getElementById('batchesStatusFilter');
  const sortSelect = document.getElementById('batchesSortSelect');
  if (filterInput && !filterInput.dataset.bound) {
    filterInput.addEventListener('input', applyBatchesFilterAndSort);
    filterInput.dataset.bound = 'true';
  }
  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.addEventListener('change', applyBatchesFilterAndSort);
    statusFilter.dataset.bound = 'true';
  }
  if (sortSelect && !sortSelect.dataset.bound) {
    sortSelect.addEventListener('change', applyBatchesFilterAndSort);
    sortSelect.dataset.bound = 'true';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    refreshBatchTable();
  });
} else {
  refreshBatchTable();
}
