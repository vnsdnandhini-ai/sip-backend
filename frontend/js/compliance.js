let complianceResultsCache = [];
let monitoringPointsCache = [];
let complianceFilter = 'all';

async function executeComplianceEvaluation() {
  const statusEl = document.getElementById('complianceStatus');
  const passRateEl = document.getElementById('compliancePassRate');
  const deviationsEl = document.getElementById('complianceDeviations');
  const statusCard = statusEl.closest('.card--metric');
  const passRateCard = passRateEl.closest('.card--metric');
  const deviationsCard = deviationsEl.closest('.card--metric');

  statusEl.textContent = 'Running...';
  try {
    await fetch(`${BACKEND_URL}/api/compliance/evaluate-all`, { method: 'POST' });
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    complianceResultsCache = state.complianceResults || [];
    monitoringPointsCache = state.monitoringPoints || [];

    const total = complianceResultsCache.length;
    const passCount = complianceResultsCache.filter((r) => r.result === 'PASS').length;
    const deviationCount = complianceResultsCache.filter((r) => r.result === 'WARNING' || r.result === 'CRITICAL').length;
    const criticalCount = complianceResultsCache.filter((r) => r.result === 'CRITICAL').length;
    const passRate = total > 0 ? ((passCount / total) * 100) : 0;

    statusEl.textContent = 'Completed';
    passRateEl.textContent = `${passRate.toFixed(1)}%`;
    deviationsEl.textContent = deviationCount;

    statusCard.classList.remove('status-good', 'status-warn', 'status-bad');
    statusCard.classList.add('status-good');

    passRateCard.classList.remove('status-good', 'status-warn', 'status-bad');
    passRateCard.classList.add(passRate >= 90 ? 'status-good' : passRate >= 70 ? 'status-warn' : 'status-bad');

    deviationsCard.classList.remove('status-good', 'status-warn', 'status-bad');
    deviationsCard.classList.add(criticalCount > 0 ? 'status-bad' : deviationCount > 0 ? 'status-warn' : 'status-good');

    renderComplianceTable();
  } catch (err) {
    console.error('Compliance evaluation failed:', err);
    statusEl.textContent = 'Error';
  }
}

function setComplianceFilter(filter) {
  complianceFilter = filter;
  document.querySelectorAll('#complianceTable').forEach(() => {});
  document.querySelectorAll('.filter-buttons .filter-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderComplianceTable();
}

function renderComplianceTable() {
  const tbody = document.querySelector('#complianceTable tbody');
  const filtered = complianceFilter === 'all'
    ? complianceResultsCache
    : complianceResultsCache.filter((r) => r.result === complianceFilter);

  tbody.innerHTML = '';
  [...filtered].reverse().forEach((r) => {
    const row = document.createElement('tr');
    const limitStatus = r.acceptanceCriteria
      ? `Accept: ${r.acceptanceCriteria} | Warn: ${r.warningCriteria || '-'} | Crit: ${r.criticalCriteria || '-'}`
      : (r.reason || '-');

    const mp = monitoringPointsCache.find((m) => m.id === r.monitoringPointId);
    const mpDisplay = mp
      ? `<span style="background:#2563eb1a;color:#2563eb;padding:2px 10px;border-radius:999px;font-size:0.8rem;">${mp.name}</span>`
      : `<span style="color:#94a3b8;font-size:0.8rem;">Unassigned</span>`;

    const resultBadgeClass = r.result === 'PASS' ? 'badge--pass' : r.result === 'WARNING' ? 'badge--warning' : r.result === 'CRITICAL' ? 'badge--critical' : 'badge--pending';

    row.innerHTML = `
      <td>${r.parameter || '-'}</td>
      <td>${mpDisplay}</td>
      <td>${r.measuredValue !== undefined ? r.measuredValue : '-'}</td>
      <td>${limitStatus}</td>
      <td><span class="badge ${resultBadgeClass}">${r.result}</span></td>
      <td>${r.recommendedAction || '-'}</td>
    `;
    tbody.appendChild(row);
  });
}

async function clearComplianceResults() {
  const confirmed = confirm('This will permanently delete all compliance evaluation results. Continue?');
  if (!confirmed) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/compliance/results`, { method: 'DELETE' });
    const data = await response.json();
    if (response.ok) {
      alert(`Cleared ${data.cleared} compliance results.`);
      complianceResultsCache = [];
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
async function loadCombinedVerdict() {
  const tbody = document.querySelector('#combinedVerdictTable tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Loading...</td></tr>`;

  try {
    const response = await fetch(`${BACKEND_URL}/api/compliance/combined-verdict`);
    const data = await response.json();
    const verdicts = data.verdicts || [];

    if (verdicts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No monitoring points defined yet.</td></tr>`;
      return;
    }

    const overallBadgeClass = {
      PASS: 'badge--pass',
      WARNING: 'badge--warning',
      CRITICAL: 'badge--critical',
      INCOMPLETE: 'badge--pending',
      NO_DATA: 'badge--pending',
    };

    tbody.innerHTML = '';
    verdicts.forEach((v) => {
      const row = document.createElement('tr');

      const spectralCell = v.spectral
        ? `<span class="badge ${v.spectral.result === 'PASS' ? 'badge--pass' : v.spectral.result === 'CRITICAL' ? 'badge--critical' : 'badge--warning'}">${v.spectral.result}</span> ${v.spectral.parameter} (${v.spectral.measuredValue})`
        : '<span style="color:#94a3b8;">No spectral data</span>';

      const visualCell = v.visual
        ? `<span class="badge ${v.visual.status === 'CLEAN' ? 'badge--pass' : v.visual.status === 'CONTAMINATED' ? 'badge--critical' : 'badge--warning'}">${v.visual.status}</span> ${v.visual.contaminationPercent}% contamination`
        : '<span style="color:#94a3b8;">No image data</span>';

      row.innerHTML = `
        <td>${v.monitoringPointName}</td>
        <td>${spectralCell}</td>
        <td>${visualCell}</td>
        <td><span class="badge ${overallBadgeClass[v.overall] || 'badge--pending'}">${v.overall.replace('_', ' ')}</span></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load combined verdict:', err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#dc2626;">Failed to load.</td></tr>`;
  }
}

if (document.getElementById('refreshCombinedVerdict')) {
  document.getElementById('refreshCombinedVerdict').addEventListener('click', loadCombinedVerdict);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('combinedVerdictTable')) {
    loadCombinedVerdict();
  }
});