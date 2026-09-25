async function refreshAuditTable() {
  const tbody = document.querySelector('#auditTable tbody');
  if (!tbody) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    const entries = state.auditTrail || [];

    tbody.innerHTML = '';

    if (entries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">No audit entries recorded yet.</td></tr>`;
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${entry.timestamp || '-'}</td><td>${entry.activity || '-'}</td><td>${entry.module || '-'}</td><td>${entry.user || '-'}</td>`;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load audit trail:', err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#dc2626;">Failed to load audit trail.</td></tr>`;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    refreshAuditTable();
    
    const form = document.getElementById('manualAuditForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('auditUser').value.trim();
        const module = document.getElementById('auditModule').value.trim();
        const activity = document.getElementById('auditActivity').value.trim();
        
        if (!user || !module || !activity) return;
        
        const btn = form.querySelector('button');
        const origText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
          await fetch(BACKEND_URL + '/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, module, activity })
          });
          
          form.reset();
          await refreshAuditTable();
        } catch (err) {
          console.error('Failed to log manual audit event:', err);
          alert('Failed to log event. Check connection.');
        } finally {
          btn.textContent = origText;
          btn.disabled = false;
        }
      });
    }
  });
}
