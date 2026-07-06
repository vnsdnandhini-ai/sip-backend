function renderReportPanel() {
  const panel = document.getElementById('reportPanel');
  if (!panel) return; // Skip if element doesn't exist on this page
  
  panel.innerHTML = `
    <div class="report-card">
      <h4>Batch Report Summary</h4>
      <p>Configured projects: ${appState.projects.length}</p>
      <p>Monitoring points: ${appState.monitoringPoints.length}</p>
      <p>Defined parameters: ${appState.parameters.length}</p>
      <p>Checkout conditions: ${appState.checkoutConditions.length}</p>
      <p>Analytical records: ${appState.analyticalData.length}</p>
    </div>
  `;
}

function exportReport(format) {
  const reportContent = generateReportContent();
  if (format === 'pdf') {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Report</title><style>body{font-family:Inter,sans-serif;padding:2rem;color:#0f172a;background:#f8fafc;}h1{margin-bottom:1rem;}table{width:100%;border-collapse:collapse;margin-top:1rem;}td,th{border:1px solid #cbd5e1;padding:0.75rem;text-align:left;}th{background:#e2e8f0;}</style></head><body>${reportContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }
  if (format === 'excel') {
    const csvRows = [];
    csvRows.push(['Report', 'Value']);
    csvRows.push(['Projects', appState.projects.length]);
    csvRows.push(['Monitoring Points', appState.monitoringPoints.length]);
    csvRows.push(['Parameters', appState.parameters.length]);
    csvRows.push(['Conditions', appState.checkoutConditions.length]);
    csvRows.push(['Analytical Records', appState.analyticalData.length]);
    csvRows.push(['Report Generated', new Date().toLocaleString()]);
    const csvContent = csvRows.map((row) => row.map((value) => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spectroscopic-intelligence-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }
}

function generateReportContent() {
  const complianceSummary = appState.complianceResults.length ? `Compliance pass rate: ${Math.round((appState.complianceResults.filter((item) => item.outcome === 'PASS').length / appState.complianceResults.length) * 100)}%` : 'No compliance evaluation data available.';
  return `
    <h1>Spectroscopic Intelligence Platform Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <h2>Summary</h2>
    <p>Projects: ${appState.projects.length}</p>
    <p>Monitoring Points: ${appState.monitoringPoints.length}</p>
    <p>Parameters: ${appState.parameters.length}</p>
    <p>Checkout Conditions: ${appState.checkoutConditions.length}</p>
    <p>Analytical Entries: ${appState.analyticalData.length}</p>
    <p>${complianceSummary}</p>
    <h2>Audit Trail</h2>
    <table><thead><tr><th>Timestamp</th><th>Activity</th><th>Module</th><th>User</th></tr></thead><tbody>${appState.auditTrail.slice(0, 10).map((entry) => `<tr><td>${entry.timestamp}</td><td>${entry.activity}</td><td>${entry.module}</td><td>${entry.user}</td></tr>`).join('')}</tbody></table>
  `;
}
