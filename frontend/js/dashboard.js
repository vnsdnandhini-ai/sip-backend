async function refreshDashboard() {
  const metricsElement = document.getElementById('metricProjects');
  if (!metricsElement) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();

    renderSetupProgress(state);

    document.getElementById('metricProjects').textContent = state.projects.length;

    const activeDevices = state.devices.filter((d) => d.status === 'active').length;
    document.getElementById('metricSessions').textContent = activeDevices;

    const results = state.complianceResults || [];
    const passCount = results.filter((r) => r.result === 'PASS').length;
    const passRate = results.length ? Math.round((passCount / results.length) * 100) : 0;
    document.getElementById('metricCompliance').textContent = `${passRate}%`;

    const deviationCount = results.filter((r) => r.result === 'WARNING' || r.result === 'CRITICAL').length;
    document.getElementById('metricDeviations').textContent = deviationCount;

    const criticalCount = results.filter((r) => r.result === 'CRITICAL').length;
    const alerts = criticalCount > 0
      ? `${criticalCount} critical deviation${criticalCount > 1 ? 's' : ''} require immediate review.`
      : 'No critical alerts at the moment.';
    document.getElementById('criticalAlerts').textContent = alerts;

    const reportsList = document.getElementById('dashboardReports');
    reportsList.innerHTML = '';
    const recentReports = (state.reports || []).slice(-5).reverse();
    if (recentReports.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'No reports generated yet.';
      reportsList.appendChild(item);
    } else {
      recentReports.forEach((report) => {
        const item = document.createElement('li');
        const title = report.content?.title || 'Untitled Report';
        const date = report.integrity?.generatedAt
          ? new Date(report.integrity.generatedAt).toLocaleDateString()
          : '-';
        item.textContent = `${title} - ${date}`;
        reportsList.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}
function renderSetupProgress(state) {
  const card = document.getElementById('setupProgressCard');
  if (!card) return;

  const steps = [
    { label: 'Project', done: (state.projects || []).length > 0 },
    { label: 'Monitoring Point', done: (state.monitoringPoints || []).length > 0 },
    { label: 'Parameter', done: (state.parameters || []).length > 0 },
    { label: 'Device', done: (state.devices || []).length > 0 },
    { label: 'Compliance Rule', done: (state.checkoutConditions || []).length > 0 },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  document.getElementById('setupProgressFill').style.width = `${percent}%`;
  document.getElementById('setupChecklist').innerHTML = steps
    .map((s) => `<div class="setup-checklist-item ${s.done ? 'done' : ''}">${s.done ? '✓' : '○'} ${s.label}</div>`)
    .join('');

  if (doneCount === steps.length) {
    card.style.display = 'none';
  } else {
    card.style.display = 'block';
  }
}
