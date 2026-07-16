// Reports page - connects to the real backend compliance engine and
// tamper-proof report generator. Replaces the old static-data version.

async function renderReportPanel() {
  const panel = document.getElementById('reportPanel');
  if (!panel) return;

  panel.innerHTML = `<p style="color:#64748b;">Select a report type above to generate a report from live data.</p>`;

  const batchCard = document.getElementById('cardBatchReport');
  const complianceCard = document.getElementById('cardComplianceReport');
  const auditCard = document.getElementById('cardAuditReport');

  if (batchCard) batchCard.addEventListener('click', showBatchReport);
  if (complianceCard) complianceCard.addEventListener('click', generateComplianceReport);
  if (auditCard) auditCard.addEventListener('click', showAuditReport);
}

function reportLoadingState(panel, label) {
  panel.innerHTML = `<p style="color:#64748b;">${label}...</p>`;
}

async function showBatchReport() {
  const panel = document.getElementById('reportPanel');
  reportLoadingState(panel, 'Loading batch summary');

  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();

    panel.innerHTML = `
      <div class="report-card">
        <h4>Batch Report Summary</h4>
        <p>Registered devices: <strong>${state.devices.length}</strong></p>
        <p>Monitoring points: <strong>${state.monitoringPoints.length}</strong></p>
        <p>Checkout conditions defined: <strong>${state.checkoutConditions.length}</strong></p>
        <p>Total sensor readings recorded: <strong>${state.analyticalData.length}</strong></p>
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>
    `;
  } catch (err) {
    panel.innerHTML = `<p style="color:#dc2626;">Failed to load batch data. Check console.</p>`;
    console.error(err);
  }
}

async function showAuditReport() {
  const panel = document.getElementById('reportPanel');
  reportLoadingState(panel, 'Loading audit trail');

  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    const entries = (state.auditTrail || []).slice(0, 10);

    const rows = entries.length
      ? entries.map((e) => `<tr><td>${e.timestamp || '-'}</td><td>${e.activity || '-'}</td><td>${e.module || '-'}</td><td>${e.user || '-'}</td></tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No audit entries yet.</td></tr>`;

    panel.innerHTML = `
      <div class="report-card">
        <h4>Audit Trail (last 10 entries)</h4>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead><tr><th>Timestamp</th><th>Activity</th><th>Module</th><th>User</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    panel.innerHTML = `<p style="color:#dc2626;">Failed to load audit trail. Check console.</p>`;
    console.error(err);
  }
}

async function generateComplianceReport() {
  const panel = document.getElementById('reportPanel');
  reportLoadingState(panel, 'Generating tamper-proof compliance report');

  try {
    const genResponse = await fetch(`${BACKEND_URL}/api/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Compliance Report',
        generatedBy: appState.session?.user || 'system',
      }),
    });
    const report = await genResponse.json();

    renderComplianceReport(report, null);
  } catch (err) {
    panel.innerHTML = `<p style="color:#dc2626;">Failed to generate report. Check console.</p>`;
    console.error(err);
  }
}

function resultBadge(result) {
  const colors = {
    PASS: '#16a34a',
    WARNING: '#d97706',
    CRITICAL: '#dc2626',
    UNEVALUATED: '#94a3b8',
    INVALID: '#94a3b8',
    OUT_OF_DEFINED_RANGE: '#94a3b8',
  };
  const color = colors[result] || '#64748b';
  return `<span style="background:${color}1a;color:${color};padding:2px 10px;border-radius:999px;font-weight:600;font-size:0.85rem;">${result}</span>`;
}

function renderComplianceReport(report, verification) {
  const panel = document.getElementById('reportPanel');
  const summary = report.content.summary;
  const groups = report.content.byMonitoringPoint || [];
  const passRate = summary.totalEvaluated ? ((summary.pass / summary.totalEvaluated) * 100).toFixed(1) : 0;

  const verifyBadge = verification
    ? verification.valid
      ? `<span style="background:#16a34a1a;color:#16a34a;padding:4px 12px;border-radius:999px;font-weight:600;">Verified - Not Tampered</span>`
      : `<span style="background:#dc26261a;color:#dc2626;padding:4px 12px;border-radius:999px;font-weight:600;">TAMPERED - Hash Mismatch</span>`
    : '';

  const groupSections = groups.map((group) => {
    const rows = group.results
      .slice()
      .reverse()
      .map((r) => `
        <tr>
          <td>${r.parameter || '-'}</td>
          <td>${r.measuredValue !== undefined ? r.measuredValue : '-'}</td>
          <td>${r.acceptanceCriteria || '-'}</td>
          <td>${resultBadge(r.result)}</td>
          <td>${r.deviation ? `${r.deviation.direction} ${r.deviation.percent}%` : '-'}</td>
          <td>${r.recommendedAction || '-'}</td>
        </tr>
      `).join('');

    const groupPass = group.results.filter((r) => r.result === 'PASS').length;
    const groupTotal = group.results.length;
    const groupPassPct = groupTotal ? Math.round((groupPass / groupTotal) * 100) : 0;

    return `
      <div class="report-section" style="margin-top:28px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;page-break-inside:avoid;">
        <div style="background:#f1f5f9;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;border-bottom:2px solid #2563eb;">
          <h5 style="margin:0;color:#1e293b;font-size:1.05rem;">${group.monitoringPointName}</h5>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:80px;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
              <div style="width:${groupPassPct}%;height:100%;background:${groupPassPct >= 80 ? '#16a34a' : groupPassPct >= 50 ? '#d97706' : '#dc2626'};"></div>
            </div>
            <span style="color:#475569;font-size:0.85rem;font-weight:600;">${groupPass}/${groupTotal} passed (${groupPassPct}%)</span>
          </div>
        </div>
        <div class="data-table-wrapper" style="margin:0;">
          <table class="data-table">
            <thead>
              <tr><th>Parameter</th><th>Value</th><th>Acceptance</th><th>Result</th><th>Deviation</th><th>Corrective Action</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No readings.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="report-card" id="printableReport">
      <div style="border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;gap:12px;align-items:center;">
          <div style="width:44px;height:44px;background:#2563eb;color:white;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;">SIP</div>
          <div>
            <h3 style="margin:0;color:#0f172a;">${report.content.title}</h3>
            <p style="margin:2px 0 0 0;color:#64748b;font-size:0.85rem;">Spectroscopic Intelligence Platform &middot; Cloud-Connected Pharmaceutical QMS</p>
          </div>
        </div>
        <button class="button button--secondary no-print" id="verifyReportBtn" data-report-id="${report.id}">Verify Integrity</button>
      </div>

      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:20px;color:#475569;font-size:0.9rem;">
        <div><strong>Generated By:</strong> ${report.content.generatedBy}</div>
        <div><strong>Date:</strong> ${new Date(report.integrity.generatedAt).toLocaleString()}</div>
        <div id="verifySlot">${verifyBadge}</div>
      </div>

      <div class="grid grid--3cards" style="margin-bottom:8px;">
        <div class="card card--metric">
          <div class="card-title">Total Evaluated</div>
          <div class="card-value">${summary.totalEvaluated}</div>
        </div>
        <div class="card card--metric">
          <div class="card-title">Overall Pass Rate</div>
          <div class="card-value" style="color:${passRate >= 80 ? '#16a34a' : passRate >= 50 ? '#d97706' : '#dc2626'};">${passRate}%</div>
        </div>
        <div class="card card--metric">
          <div class="card-title">Total Deviations</div>
          <div class="card-value" style="color:#dc2626;">${summary.warning + summary.critical}</div>
        </div>
      </div>

      <div style="width:100%;height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;margin:12px 0 20px 0;">
        <div style="width:${passRate}%;height:100%;background:${passRate >= 80 ? '#16a34a' : passRate >= 50 ? '#d97706' : '#dc2626'};"></div>
      </div>

      <div style="display:flex;gap:24px;margin-bottom:8px;font-size:0.9rem;color:#475569;">
        <div>${resultBadge('PASS')} ${summary.pass}</div>
        <div>${resultBadge('WARNING')} ${summary.warning}</div>
        <div>${resultBadge('CRITICAL')} ${summary.critical}</div>
      </div>

      <h4 style="margin:24px 0 4px 0;border-top:1px solid #e2e8f0;padding-top:20px;color:#0f172a;">Results by Monitoring Point</h4>
      ${groupSections || '<p style="color:#94a3b8;">No readings linked to a monitoring point yet.</p>'}

      <div style="margin-top:28px;padding:14px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;font-family:monospace;font-size:0.78rem;color:#64748b;word-break:break-all;">
        <div><strong>Report ID:</strong> ${report.id}</div>
        <div><strong>SHA-256 Hash:</strong> ${report.integrity.hash}</div>
        <div><strong>This document is cryptographically sealed. Any modification after generation invalidates the hash above.</strong></div>
      </div>
    </div>
  `;

  document.getElementById('verifyReportBtn').addEventListener('click', async () => {
    const reportId = document.getElementById('verifyReportBtn').dataset.reportId;
    const verifySlot = document.getElementById('verifySlot');
    verifySlot.innerHTML = `<span style="color:#64748b;">Verifying...</span>`;
    try {
      const res = await fetch(`${BACKEND_URL}/api/reports/${reportId}/verify`);
      const result = await res.json();
      verifySlot.innerHTML = result.valid
        ? `<span style="background:#16a34a1a;color:#16a34a;padding:4px 12px;border-radius:999px;font-weight:600;">Verified - Not Tampered</span>`
        : `<span style="background:#dc26261a;color:#dc2626;padding:4px 12px;border-radius:999px;font-weight:600;">TAMPERED - Hash Mismatch</span>`;
    } catch (err) {
      verifySlot.innerHTML = `<span style="color:#dc2626;">Verification failed - check console.</span>`;
      console.error(err);
    }
  });
}function exportReport(format) {
  const panel = document.getElementById('reportPanel');
  if (!panel || !panel.innerHTML.includes('report-card')) {
    alert('Please generate a report first by clicking one of the report cards above.');
    return;
  }

 if (format === 'pdf') {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Compliance Report</title>
          <style>
            @page { margin: 20mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; color: #0f172a; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
            td, th { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 0.85rem; }
            th { background: #f1f5f9; }
            h3, h4, h5 { font-family: 'Segoe UI', Arial, sans-serif; }
            .no-print { display: none !important; }
            .report-section { page-break-inside: avoid; }
          </style>
        </head>
        <body>${panel.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }

  if (format === 'excel') {
    const rows = panel.querySelectorAll('table tr');
    const csvRows = [];
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('th, td')).map((cell) => `"${cell.textContent.trim()}"`);
      csvRows.push(cells.join(','));
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spectroscopic-intelligence-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
