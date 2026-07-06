function refreshAuditTable() {
  const tbody = document.querySelector('#auditTable tbody');
  if (!tbody) return; // Skip if element doesn't exist on this page
  tbody.innerHTML = '';
  appState.auditTrail.forEach((entry) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${entry.timestamp}</td><td>${entry.activity}</td><td>${entry.module}</td><td>${entry.user}</td>`;
    tbody.appendChild(row);
  });
}
