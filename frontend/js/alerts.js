// Spectroscopic Intelligence Platform - Unified Alert Center Controller
let currentAlertFilter = 'all';
let aggregatedAlerts = [];

async function initAlertsPage() {
  await fetchLiveAnalyticalData();
  renderAlerts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAlertsPage);
} else {
  initAlertsPage();
}

function setAlertFilter(filter) {
  currentAlertFilter = filter;
  document.querySelectorAll('.filter-buttons .filter-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderAlertTable();
}

function renderAlerts() {
  aggregatedAlerts = [];

  const batches = appState.batches || appState.projects || [];
  const batchMap = {};
  batches.forEach(b => { batchMap[b.id] = b; });

  // 1. Compliance Engine results for WARNING / CRITICAL
  if (appState.complianceResults) {
    appState.complianceResults.forEach(r => {
      if (r.result === 'WARNING' || r.result === 'CRITICAL') {
        const linkedBatch = batchMap[r.projectId || r.batchId] || null;
        aggregatedAlerts.push({
          severity: r.result,
          time: r.evaluatedAt || new Date().toISOString(),
          source: 'Compliance Engine (Limits)',
          batchId: linkedBatch ? linkedBatch.id : null,
          batchDisplay: linkedBatch ? `${linkedBatch.name} (${linkedBatch.batchNumber})` : 'Unassigned Batch',
          desc: `Parameter "${r.parameter}" measured at ${r.measuredValue} ${r.deviation ? `(${r.deviation.percent}% deviation)` : ''}. Limit: ${r.acceptanceCriteria || r.warningCriteria || '-'}`,
          action: r.recommendedAction || 'Execute OOS investigation and check calibration'
        });
      }
    });
  }

  // 2. AI Image Vision & Defect Detections
  if (appState.analyticalData) {
    appState.analyticalData.forEach(d => {
      if (d.dataType === 'image' && d.imageAnalysis) {
        const ai = d.imageAnalysis.ai;
        const linkedBatch = batchMap[d.projectId || d.batchId] || null;

        if (ai) {
          const conf = ai.confidence_score !== undefined ? parseFloat(ai.confidence_score) : 90;
          if (conf < 70 || ai.visual_qa_result === 'REVIEW REQUIRED') {
            aggregatedAlerts.push({
              severity: 'REVIEW REQUIRED',
              time: d.timestamp || d.receivedAt || new Date().toISOString(),
              source: 'AI Vision Screening',
              batchId: linkedBatch ? linkedBatch.id : null,
              batchDisplay: linkedBatch ? `${linkedBatch.name} (${linkedBatch.batchNumber})` : 'Unassigned Batch',
              desc: `Low confidence (${conf}%) prediction for ${ai.raw_material_class || 'sample'}.`,
              action: 'Perform manual visual inspection and spectroscopic re-test'
            });
          }

          if (ai.visual_qa_result === 'CRITICAL' || (ai.condition && ai.condition.toLowerCase().includes('defective'))) {
            aggregatedAlerts.push({
              severity: 'CRITICAL',
              time: d.timestamp || d.receivedAt || new Date().toISOString(),
              source: 'AI Defect Detection',
              batchId: linkedBatch ? linkedBatch.id : null,
              batchDisplay: linkedBatch ? `${linkedBatch.name} (${linkedBatch.batchNumber})` : 'Unassigned Batch',
              desc: `Visual defect / contamination identified: "${ai.detected_defect || 'Surface abnormality'}" on ${ai.raw_material_class || 'specimen'}.`,
              action: 'Quarantine material sample and initiate QA defect report'
            });
          }
        }
      }
    });
  }

  // 3. Dispensing Weight Deviations
  if (appState.dispensingLogs) {
    appState.dispensingLogs.forEach(d => {
      if (d.status === 'WARNING' || d.status === 'CRITICAL') {
        const linkedBatch = batchMap[d.batchId] || null;
        aggregatedAlerts.push({
          severity: d.status,
          time: d.timestamp || new Date().toISOString(),
          source: 'Dispensing & Weighing',
          batchId: linkedBatch ? linkedBatch.id : null,
          batchDisplay: linkedBatch ? `${linkedBatch.name} (${linkedBatch.batchNumber})` : 'Unassigned Batch',
          desc: `Dispensing weight deviation: ${d.deviationPercent > 0 ? '+' : ''}${d.deviationPercent}% (Target: ${d.targetQuantity} kg, Actual: ${d.actualQuantity} kg)`,
          action: 'Re-weigh on calibrated analytical balance before batch progression'
        });
      }
    });
  }

  // Sort newest first
  aggregatedAlerts.sort((a, b) => new Date(b.time) - new Date(a.time));

  updateAlertMetrics();
  renderAlertTable();
}

function updateAlertMetrics() {
  const total = aggregatedAlerts.length;
  const critical = aggregatedAlerts.filter(a => a.severity === 'CRITICAL').length;
  const warning = aggregatedAlerts.filter(a => a.severity === 'WARNING').length;
  const review = aggregatedAlerts.filter(a => a.severity === 'REVIEW REQUIRED').length;

  document.getElementById('metricTotalAlerts').textContent = total;
  document.getElementById('metricCriticalAlerts').textContent = critical;
  document.getElementById('metricWarningAlerts').textContent = warning;
  document.getElementById('metricReviewAlerts').textContent = review;
}

function renderAlertTable() {
  const tbody = document.querySelector('#alertsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = currentAlertFilter === 'all'
    ? aggregatedAlerts
    : aggregatedAlerts.filter(a => a.severity === currentAlertFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px;">No alerts match the selected criteria. System operating within defined tolerances.</td></tr>';
    return;
  }

  filtered.forEach(a => {
    let badgeClass = 'badge--warning';
    if (a.severity === 'CRITICAL') badgeClass = 'badge--critical';
    if (a.severity === 'REVIEW REQUIRED') badgeClass = 'badge--pending';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="badge ${badgeClass}">${a.severity}</span></td>
      <td>${new Date(a.time).toLocaleString()}</td>
      <td><strong>${a.source}</strong></td>
      <td>
        ${a.batchId ? `<a href="batch-details.html?id=${a.batchId}" style="color:var(--primary);font-weight:600;text-decoration:none;">${a.batchDisplay} →</a>` : a.batchDisplay}
      </td>
      <td>${a.desc}</td>
      <td>${a.action}</td>
    `;
    tbody.appendChild(row);
  });
}
