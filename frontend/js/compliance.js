async function executeComplianceEvaluation() {
  const statusEl = document.getElementById('complianceStatus');
  const passRateEl = document.getElementById('compliancePassRate');
  const deviationsEl = document.getElementById('complianceDeviations');
  const tbody = document.querySelector('#complianceTable tbody');
  statusEl.textContent = 'Running...';
  try {
    await fetch(`${BACKEND_URL}/api/compliance/evaluate-all`, { method: 'POST' });
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    const results = state.complianceResults || [];
    const monitoringPoints = state.monitoringPoints || [];

    const total = results.length;
    const passCount = results.filter((r) => r.result === 'PASS').length;
    const deviationCount = results.filter((r) => r.result === 'WARNING' || r.result === 'CRITICAL').length;
    const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : 0;
    statusEl.textContent = 'Completed';
    passRateEl.textContent = `${passRate}%`;
    deviationsEl.textContent = deviationCount;

    tbody.innerHTML = '';
    [...results].reverse().forEach((r) => {
      const row = document.createElement('tr');
      const limitStatus = r.acceptanceCriteria
        ? `Accept: ${r.acceptanceCriteria} | Warn: ${r.warningCriteria || '-'} | Crit: ${r.criticalCriteria || '-'}`
        : (r.reason || '-');

      const mp = monitoringPoints.find((m) => m.id === r.monitoringPointId);
      const mpDisplay = mp
        ? `<span style="background:#2563eb1a;color:#2563eb;padding:2px 10px;border-radius:999px;font-size:0.8rem;">${mp.name}</span>`
        : `<span style="color:#94a3b8;font-size:0.8rem;">Unassigned</span>`;

      row.innerHTML = `
        <td>${r.parameter || '-'}</td>
        <td>${mpDisplay}</td>
        <td>${r.measuredValue !== undefined ? r.measuredValue : '-'}</td>
        <td>${limitStatus}</td>
        <td>${r.result}</td>
        <td>${r.recommendedAction || '-'}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Compliance evaluation failed:', err);
    statusEl.textContent = 'Error';
  }
}
async function clearComplianceResults() {
  const confirmed = confirm('This will permanently delete all compliance evaluation results. Continue?');
  if (!confirmed) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/compliance/results`, { method: 'DELETE' });
    const data = await response.json();
    if (response.ok) {
      alert(`Cleared ${data.cleared} compliance results.`);
      document.getElementById('complianceStatus').textContent = 'Idle';
      document.getElementById('compliancePassRate').textContent = '0%';
      document.getElementById('complianceDeviations').textContent = '0';
      document.querySelector('#complianceTable tbody').innerHTML = '';
    } else {
      alert('Failed to clear results.');
    }
  } catch (err) {
    console.error('Failed to clear compliance results:', err);
    alert('Error clearing results. Check console.');
  }
}

if (document.getElementById('clearComplianceResults')) {
  document.getElementById('clearComplianceResults').addEventListener('click', clearComplianceResults);
}