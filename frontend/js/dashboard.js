function refreshDashboard() {
  const metricsElement = document.getElementById('metricProjects');
  if (!metricsElement) return; // Skip if element doesn't exist on this page
  
  document.getElementById('metricProjects').textContent = appState.projects.length;
  document.getElementById('metricSessions').textContent = appState.analyticalData.length > 0 ? 1 : 0;
  const complianceTrue = appState.complianceResults.filter((result) => result.outcome === 'PASS').length;
  const passRate = appState.complianceResults.length ? Math.round((complianceTrue / appState.complianceResults.length) * 100) : 0;
  document.getElementById('metricCompliance').textContent = `${passRate}%`;
  const deviationCount = appState.complianceResults.filter((result) => result.outcome === 'FAIL').length;
  document.getElementById('metricDeviations').textContent = deviationCount;

  const alerts = deviationCount > 0 ? `${deviationCount} active data deviations require review.` : 'No critical alerts at the moment.';
  document.getElementById('criticalAlerts').textContent = alerts;

  const reportsList = document.getElementById('dashboardReports');
  reportsList.innerHTML = '';
  appState.reports.slice(0, 5).forEach((report) => {
    const item = document.createElement('li');
    item.textContent = `${report.title} • ${new Date(report.generatedAt).toLocaleDateString()}`;
    reportsList.appendChild(item);
  });
}
