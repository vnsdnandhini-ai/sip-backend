let projectsCache = [];

async function loadProjects() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    projectsCache = state.projects || [];
    appState.projects = projectsCache;
    return projectsCache;
  } catch (err) {
    console.error('Failed to load projects:', err);
    return [];
  }
}

function openProjectForm(id = null) {
  const project = projectsCache.find((item) => item.id === id) || {
    name: '',
    product: '',
    batchNumber: '',
    department: '',
    line: '',
    status: 'Active',
  };
  openModal(
    id ? 'Edit Project' : 'Create Project',
    `<form id="projectForm" class="panel-form">
      <div class="form-group"><label>Project Name</label><input id="projectName" type="text" value="${project.name}" required /></div>
      <div class="form-group"><label>Product Name</label><input id="productName" type="text" value="${project.product}" required /></div>
      <div class="form-group"><label>Batch Number</label><input id="batchNumber" type="text" value="${project.batchNumber}" required /></div>
      <div class="form-group"><label>Department</label><input id="department" type="text" value="${project.department || ''}" /></div>
      <div class="form-group"><label>Manufacturing Line</label><input id="line" type="text" value="${project.line || ''}" /></div>
      <div class="form-group"><label>Status</label><select id="status"><option value="Active">Active</option><option value="Completed">Completed</option><option value="Paused">Paused</option></select></div>
    </form>`,
    id ? 'Save Changes' : 'Create Project',
    () => submitProjectForm(id)
  );
  document.getElementById('status').value = project.status;
}

async function submitProjectForm(id) {
  const name = document.getElementById('projectName').value.trim();
  const product = document.getElementById('productName').value.trim();
  const batchNumber = document.getElementById('batchNumber').value.trim();
  const department = document.getElementById('department').value.trim();
  const line = document.getElementById('line').value.trim();
  const status = document.getElementById('status').value;

  if (!name || !product || !batchNumber) {
    alert('Project Name, Product Name, and Batch Number are required.');
    return;
  }

  try {
    if (id) {
      await fetch(`${BACKEND_URL}/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, product, batchNumber, department, line, status }),
      });
    } else {
      await fetch(`${BACKEND_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, product, batchNumber, department, line, status }),
      });
    }
   recordAudit(id ? 'Project Updated' : 'Project Created', 'Project Management');
    closeModal();
    await refreshProjectTable();
  } catch (err) {
    console.error('Failed to save project:', err);
    alert('Failed to save. Check console.');
  }
}

async function deleteProject(id) {
  try {
   await fetch(`${BACKEND_URL}/api/projects/${id}`, { method: 'DELETE' });
    recordAudit('Project Deleted', 'Project Management');
    await refreshProjectTable();
  } catch (err) {
    console.error('Failed to delete project:', err);
    alert('Failed to delete. Check console.');
  }
}

function statusBadge(status) {
  const colors = { Active: '#16a34a', Completed: '#2563eb', Paused: '#d97706' };
  const color = colors[status] || '#64748b';
  return `<span style="background:${color}1a;color:${color};padding:2px 10px;border-radius:999px;font-weight:600;font-size:0.85rem;">${status}</span>`;
}

function renderProjectRows(projects) {
  const tbody = document.querySelector('#projectsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (projects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">No projects created yet.</td></tr>`;
    return;
  }

  projects.forEach((project) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${project.name}</td><td>${project.product}</td><td>${project.batchNumber}</td><td>${project.department || '-'}</td><td>${project.line || '-'}</td><td>${statusBadge(project.status)}</td><td>${createRowActions(project.id, 'project')}</td>`;
    tbody.appendChild(row);
  });

  const countEl = document.getElementById('projectsResultCount');
  if (countEl) countEl.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
}

function applyProjectsFilterAndSort() {
  const filterInput = document.getElementById('projectsFilterInput');
  const statusFilter = document.getElementById('projectsStatusFilter');
  const sortSelect = document.getElementById('projectsSortSelect');

  let filtered = [...projectsCache];

  if (filterInput && filterInput.value.trim()) {
    const query = filterInput.value.trim().toLowerCase();
    filtered = filtered.filter((p) =>
      p.name.toLowerCase().includes(query) ||
      p.product.toLowerCase().includes(query) ||
      p.batchNumber.toLowerCase().includes(query)
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

  renderProjectRows(filtered);
}

async function refreshProjectTable() {
  const tbody = document.querySelector('#projectsTable tbody');
  if (!tbody) return;

  await loadProjects();
  applyProjectsFilterAndSort();

  const filterInput = document.getElementById('projectsFilterInput');
  const statusFilter = document.getElementById('projectsStatusFilter');
  const sortSelect = document.getElementById('projectsSortSelect');
  if (filterInput && !filterInput.dataset.bound) {
    filterInput.addEventListener('input', applyProjectsFilterAndSort);
    filterInput.dataset.bound = 'true';
  }
  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.addEventListener('change', applyProjectsFilterAndSort);
    statusFilter.dataset.bound = 'true';
  }
  if (sortSelect && !sortSelect.dataset.bound) {
    sortSelect.addEventListener('change', applyProjectsFilterAndSort);
    sortSelect.dataset.bound = 'true';
  }
}
