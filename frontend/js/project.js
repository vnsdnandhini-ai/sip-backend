function openProjectForm(id = null) {
  const project = appState.projects.find((item) => item.id === id) || {
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
      <div class="form-group"><label>Department</label><input id="department" type="text" value="${project.department}" /></div>
      <div class="form-group"><label>Manufacturing Line</label><input id="line" type="text" value="${project.line}" /></div>
      <div class="form-group"><label>Status</label><select id="status"><option value="Active">Active</option><option value="Completed">Completed</option><option value="Paused">Paused</option></select></div>
    </form>`,
    id ? 'Save Changes' : 'Create Project',
    () => submitProjectForm(id)
  );
  document.getElementById('status').value = project.status;
}

function submitProjectForm(id) {
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
  if (id) {
    const project = appState.projects.find((item) => item.id === id);
    Object.assign(project, { name, product, batchNumber, department, line, status });
    recordAudit('Project Updated', 'Project Management');
  } else {
    appState.projects.push({ id: generateId(), name, product, batchNumber, department, line, status });
    recordAudit('Project Created', 'Project Management');
  }
  saveState();
  refreshProjectTable();
  closeModal();
}

function refreshProjectTable() {
  const tbody = document.querySelector('#projectsTable tbody');
  if (!tbody) return; // Skip if element doesn't exist on this page
  tbody.innerHTML = '';
  appState.projects.forEach((project) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${project.name}</td><td>${project.product}</td><td>${project.batchNumber}</td><td>${project.department}</td><td>${project.line}</td><td>${project.status}</td><td>${createRowActions(project.id, 'project')}</td>`;
    tbody.appendChild(row);
  });
}

function deleteProject(id) {
  appState.projects = appState.projects.filter((project) => project.id !== id);
  recordAudit('Project Deleted', 'Project Management');
  saveState();
  refreshProjectTable();
}
