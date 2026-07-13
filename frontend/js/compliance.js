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
      row.innerHTML = `
        <td>${r.parameter || '-'}</td>
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