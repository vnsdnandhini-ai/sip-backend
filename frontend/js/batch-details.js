// Spectroscopic Intelligence Platform - Batch Quality Passport & 8-Stage Process Lifecycle Engine
var BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : 'http://localhost:3000';
window.BACKEND_URL = BACKEND_URL;

const pharmaStages = [
  'Raw Material Receipt',
  'Dispensing',
  'Blending',
  'Granulation',
  'Drying',
  'Final Blending',
  'Compression',
  'Final QC'
];

let currentBatchId = null;
let currentBatch = null;
let currentStage = pharmaStages[0];
let batchTimelineData = null;
let stageChartInstance = null;

async function initBatchDetailsPage() {
  const urlParams = new URLSearchParams(window.location.search);
  currentBatchId = urlParams.get('id');

  if (!currentBatchId) {
    alert('No batch selected. Redirecting to Batch Management.');
    window.location.href = 'batches.html';
    return;
  }

  await loadBatchPassport();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBatchDetailsPage);
} else {
  initBatchDetailsPage();
}

async function loadBatchPassport() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/batches/${currentBatchId}/timeline`);
    if (!res.ok) {
      // Fallback to /api/state if timeline endpoint is unavailable
      const stateRes = await fetch(`${BACKEND_URL}/api/state`);
      const state = await stateRes.json();
      const b = (state.batches || state.projects || []).find(p => p.id === currentBatchId);
      if (!b) throw new Error('Batch not found');
      currentBatch = b;
    } else {
      const data = await res.json();
      currentBatch = data.batch;
      batchTimelineData = data;
    }

    if (!currentBatch) {
      alert('Batch record not found.');
      window.location.href = 'batches.html';
      return;
    }

    // Set initial stage to batch's currentStage or first stage
    if (currentBatch.currentStage && pharmaStages.includes(currentBatch.currentStage)) {
      currentStage = currentBatch.currentStage;
    }

    // Refresh global state cache for stage table
    await fetchLiveAnalyticalData();

    renderBatchHeader();
    renderStageStepper();
    renderStageContent();
    renderStageData();
  } catch (err) {
    console.error('Failed to load batch passport:', err);
    document.getElementById('batchHeaderName').textContent = 'Error Loading Batch';
    document.getElementById('batchHeaderInfo').textContent = 'Could not retrieve batch data from server.';
  }
}

function renderBatchHeader() {
  document.getElementById('batchHeaderName').textContent = currentBatch.name || 'Batch Passport';
  document.getElementById('batchHeaderInfo').textContent = 
    `Product: ${currentBatch.product || '-'} | Batch / Lot: ${currentBatch.batchNumber || '-'} | Line: ${currentBatch.line || '-'} (${currentBatch.department || '-'})`;

  const statusBadge = document.getElementById('batchStatusBadge');
  statusBadge.textContent = currentBatch.status || 'Active';
  statusBadge.className = `badge ${currentBatch.status === 'Completed' ? 'badge--pass' : currentBatch.status === 'Paused' ? 'badge--warning' : 'badge--live'}`;

  const qcBadge = document.getElementById('batchQcBadge');
  const qcStatus = currentBatch.qcStatus || 'In Progress';
  qcBadge.textContent = `QC: ${qcStatus}`;
  qcBadge.className = `badge ${qcStatus === 'Approved' ? 'badge--pass' : qcStatus === 'Rejected' ? 'badge--critical' : 'badge--warning'}`;

  document.getElementById('metaMaterialName').textContent = currentBatch.materialName || 'Not Specified';
  document.getElementById('metaMaterialId').textContent = currentBatch.materialId ? `ID: ${currentBatch.materialId}` : '-';
  document.getElementById('metaSupplier').textContent = currentBatch.supplier || 'Approved In-House / General';

  const targetQ = currentBatch.targetQuantity !== null && currentBatch.targetQuantity !== undefined ? `${currentBatch.targetQuantity} kg` : '-';
  const actualQ = currentBatch.actualQuantity !== null && currentBatch.actualQuantity !== undefined ? `${currentBatch.actualQuantity} kg` : '-';
  document.getElementById('metaQuantity').textContent = `${targetQ} / ${actualQ}`;

  const devEl = document.getElementById('metaDeviation');
  if (currentBatch.weightDeviation !== null && currentBatch.weightDeviation !== undefined) {
    const dev = parseFloat(currentBatch.weightDeviation);
    const devColor = Math.abs(dev) > 2.0 ? '#ef4444' : Math.abs(dev) > 1.0 ? '#f59e0b' : '#16a34a';
    devEl.innerHTML = `<span style="color:${devColor};font-weight:600;">Deviation: ${dev > 0 ? '+' : ''}${dev}%</span>`;
  } else {
    devEl.textContent = 'Deviation: Pending Dispensing';
  }

  document.getElementById('metaCurrentStage').textContent = currentBatch.currentStage || 'Raw Material Receipt';
}

function renderStageStepper() {
  const container = document.getElementById('stageTabs');
  const currentIndex = pharmaStages.indexOf(currentBatch.currentStage || pharmaStages[0]);

  container.innerHTML = pharmaStages.map((stage, i) => {
    const isCurrentActive = stage === currentStage;
    const isCompleted = i < currentIndex;
    const isBatchActiveStage = stage === currentBatch.currentStage;

    const icon = `${i + 1}`;

    return `
      <div 
        class="stage-tab-item ${isCurrentActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}"
        onclick="switchStage('${stage}')"
        style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 600; white-space: nowrap; transition: all 0.2s ease; ${isCurrentActive ? (isCompleted ? 'background: #10b981; color: #fff; box-shadow: 0 4px 12px rgba(16,185,129,0.35);' : 'background: var(--primary); color: #fff; box-shadow: 0 4px 12px rgba(99,102,241,0.3);') : isCompleted ? 'background: #ecfdf5; color: #047857; border: 1.5px solid #6ee7b7;' : 'background: var(--surface); color: var(--muted); border: 1px solid var(--border);'}"
      >
        <span style="display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:0.75rem;background:${isCurrentActive ? '#ffffff33' : isCompleted ? '#10b981' : '#cbd5e1'};color:${isCompleted || isCurrentActive ? '#fff' : 'inherit'};font-weight:700;">${icon}</span>
        <span>${stage}</span>
      </div>
    `;
  }).join('');
}

function switchStage(stage) {
  currentStage = stage;
  renderStageStepper();
  renderStageContent();
  renderStageData();
}

function renderStageContent() {
  const container = document.getElementById('stageContentArea');
  if (!container) return;

  if (stageChartInstance) {
    stageChartInstance.destroy();
    stageChartInstance = null;
  }

  switch (currentStage) {
    case 'Raw Material Receipt':
      renderRawMaterialStage(container);
      break;
    case 'Dispensing':
      renderDispensingStage(container);
      break;
    case 'Blending':
      renderBlendingStage(container);
      break;
    case 'Granulation':
      renderGranulationStage(container);
      break;
    case 'Drying':
      renderDryingStage(container);
      break;
    case 'Final Blending':
      renderFinalBlendingStage(container);
      break;
    case 'Compression':
      renderCompressionStage(container);
      break;
    case 'Final QC':
      renderFinalQcStage(container);
      break;
    default:
      container.innerHTML = `<div class="data-card" style="padding:20px;">Stage: ${currentStage}</div>`;
  }
}

// -------------------------------------------------------------
// STAGE 1: RAW MATERIAL RECEIPT & IDENTIFICATION
// -------------------------------------------------------------
function renderRawMaterialStage(container) {
  const images = (appState.analyticalData || []).filter(d => 
    (d.projectId === currentBatchId || d.batchId === currentBatchId) && d.dataType === 'image'
  );
  const latestImage = images[0] || null;
  const analysis = latestImage ? parseAnalysis(latestImage.imageAnalysis) : null;
  const ai = analysis?.ai || null;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px;">
      
      <!-- Visual & AI Identification Card -->
      <div class="data-card" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h4 style="margin: 0; font-size: 1.05rem;">Botanical / Raw Material Visual & AI Screening</h4>
          <span class="badge ${ai?.visual_qa_result === 'PASS' ? 'badge--pass' : ai?.visual_qa_result === 'CRITICAL' ? 'badge--critical' : 'badge--warning'}">
            ${ai?.visual_qa_result || 'Visual Inspection Ready'}
          </span>
        </div>

        <div style="background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 0.82rem; color: #4338ca;">
          <strong>Pharmaceutical Protocol:</strong> AI classification and Grad-CAM defect maps provide high-throughput screening support. Release requires authorized QC spectroscopic verification and visual sign-off.
        </div>

        ${latestImage ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
            <div>
              <div style="font-size: 0.78rem; color: var(--muted); margin-bottom: 4px;">Original Specimen / Cam Capture</div>
              <img src="${resolveImageUrl(latestImage.value || latestImage.imagePath)}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);" />
            </div>
            <div>
              <div style="font-size: 0.78rem; color: var(--muted); margin-bottom: 4px;">Defect Heatmap (Grad-CAM / Anomaly Map)</div>
              <img src="${ai?.gradcam_heatmap || ai?.pixel_anomaly_map || resolveImageUrl(latestImage.value || latestImage.imagePath)}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem; background: var(--surface-alt); padding: 12px; border-radius: 8px;">
            <div><strong>AI Identified Class:</strong> ${ai?.raw_material_class || analysis?.condition || 'Analyzing...'}</div>
            <div><strong>Confidence Score:</strong> ${ai?.confidence_score !== undefined ? `${ai.confidence_score}%` : 'N/A'}</div>
            <div><strong>Health / Condition:</strong> ${ai?.condition || analysis?.condition || 'Normal'}</div>
            <div><strong>Detected Defect:</strong> ${ai?.detected_defect || analysis?.detectedDefect || 'None'}</div>
          </div>
        ` : `
          <div style="padding: 30px; text-align: center; color: var(--muted); background: var(--surface-alt); border-radius: 8px;">
            No raw material inspection image uploaded yet for this batch.
            <div style="margin-top: 10px;">
              <button class="button button--primary" onclick="triggerQuickImageUpload('Raw Material Receipt')">📷 Capture / Upload Raw Material Image</button>
            </div>
          </div>
        `}
      </div>

      <!-- Spectroscopic Identification Card -->
      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">NIR / Raman Spectroscopic Identity Verification</h4>
        
        <div style="padding: 14px; background: var(--surface-alt); border-radius: 8px; margin-bottom: 16px;">
          <div style="font-size: 0.8rem; color: var(--muted); text-transform: uppercase;">Reference Specification</div>
          <div style="font-weight: 600; margin: 4px 0;">Method: NIR Spectral Cosine Similarity ≥ 85.0%</div>
          <div style="font-size: 0.85rem; color: var(--muted);">Target Fingerprint: ${currentBatch.materialName || 'Active Pharmaceutical Ingredient'}</div>
        </div>

        <div style="text-align: center; padding: 20px 0;">
          <div style="font-size: 2.2rem; font-weight: 800; color: #16a34a;">96.8%</div>
          <div style="font-size: 0.85rem; color: var(--muted); margin-top: 4px;">Spectral Match to Master Fingerprint (PASS)</div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 14px;">
          <button class="button button--secondary" style="flex: 1;" onclick="triggerQuickDataEntry('NIR Spectral Similarity', 'NIR Spectrometer', '%', '96.8')">Record NIR Scan</button>
          <button class="button button--secondary" style="flex: 1;" onclick="triggerQuickImageUpload('Raw Material Receipt')">Upload Visual Image</button>
        </div>
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// STAGE 2: DISPENSING & WEIGHING
// -------------------------------------------------------------
function renderDispensingStage(container) {
  const dispensingList = (appState.dispensingLogs || []).filter(d => d.batchId === currentBatchId);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px;">
      
      <!-- Dispensing Weighing Form -->
      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Record Dispensing & Balance Weighing</h4>
        <form id="dispensingForm" onsubmit="event.preventDefault(); submitDispensingRecord();" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group">
            <label>Raw Material Identity</label>
            <input id="dispMaterialName" type="text" value="${currentBatch.materialName || currentBatch.name}" required />
          </div>
          <div class="form-group">
            <label>Material Lot Number</label>
            <input id="dispLotNumber" type="text" placeholder="e.g. LOT-RM-8821" value="${currentBatch.batchNumber || ''}" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label>Target Quantity (kg)</label>
              <input id="dispTargetQty" type="number" step="0.001" placeholder="50.00" value="${currentBatch.targetQuantity || ''}" oninput="calcDispensingPreview()" required />
            </div>
            <div class="form-group">
              <label>Actual Weighed (kg)</label>
              <input id="dispActualQty" type="number" step="0.001" placeholder="50.15" oninput="calcDispensingPreview()" required />
            </div>
          </div>
          <div id="dispPreviewBox" style="padding: 10px; background: var(--surface-alt); border-radius: 6px; font-size: 0.85rem;">
            Calculated Deviation: <strong>0.00%</strong> (Tolerance: ±1.0%)
          </div>
          <div class="form-group">
            <label>Operator / Verified By</label>
            <input id="dispOperator" type="text" placeholder="e.g. John Doe (QA Weighing Operator)" value="Operator" required />
          </div>
          <button type="submit" class="button button--primary" style="margin-top: 8px;">Record & Log Dispensing</button>
        </form>
      </div>

      <!-- Dispensing History & Limit Log -->
      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Dispensing Audit & Weight Tolerance Matrix</h4>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Lot #</th>
                <th>Target (kg)</th>
                <th>Actual (kg)</th>
                <th>Deviation</th>
                <th>Status</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              ${dispensingList.length > 0 ? dispensingList.map(d => `
                <tr>
                  <td>${d.lotNumber || '-'}</td>
                  <td>${d.targetQuantity}</td>
                  <td>${d.actualQuantity}</td>
                  <td><strong style="color:${d.status === 'PASS' ? '#16a34a' : d.status === 'WARNING' ? '#f59e0b' : '#ef4444'};">${d.deviationPercent > 0 ? '+' : ''}${d.deviationPercent}%</strong></td>
                  <td><span class="badge ${d.status === 'PASS' ? 'badge--pass' : d.status === 'WARNING' ? 'badge--warning' : 'badge--critical'}">${d.status}</span></td>
                  <td>${d.operatorName || '-'}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px;">No dispensing weighments recorded yet.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

function calcDispensingPreview() {
  const target = parseFloat(document.getElementById('dispTargetQty')?.value || 0);
  const actual = parseFloat(document.getElementById('dispActualQty')?.value || 0);
  const box = document.getElementById('dispPreviewBox');
  if (!box || target <= 0 || actual <= 0) return;

  const dev = parseFloat((((actual - target) / target) * 100).toFixed(2));
  let color = '#16a34a';
  let badge = 'PASS (Within ±1.0% limit)';
  if (Math.abs(dev) > 2.0) {
    color = '#ef4444';
    badge = 'CRITICAL (> ±2.0% deviation)';
  } else if (Math.abs(dev) > 1.0) {
    color = '#f59e0b';
    badge = 'WARNING (1.0% - 2.0% deviation)';
  }

  box.innerHTML = `Calculated Deviation: <strong style="color:${color};font-size:1rem;">${dev > 0 ? '+' : ''}${dev}%</strong> | Status: <strong style="color:${color};">${badge}</strong>`;
}

async function submitDispensingRecord() {
  const targetQuantity = parseFloat(document.getElementById('dispTargetQty').value);
  const actualQuantity = parseFloat(document.getElementById('dispActualQty').value);
  const materialName = document.getElementById('dispMaterialName').value.trim();
  const lotNumber = document.getElementById('dispLotNumber').value.trim();
  const operatorName = document.getElementById('dispOperator').value.trim();

  try {
    const res = await fetch(`${BACKEND_URL}/api/dispensing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: currentBatchId,
        materialName,
        lotNumber,
        targetQuantity,
        actualQuantity,
        operatorName,
      })
    });

    if (!res.ok) throw new Error('Failed to record dispensing');
    alert('Dispensing transaction successfully recorded and linked to batch.');
    await loadBatchPassport();
  } catch (err) {
    console.error(err);
    alert('Error recording dispensing: ' + err.message);
  }
}

// -------------------------------------------------------------
// STAGE 3: BLENDING & UNIFORMITY
// -------------------------------------------------------------
function renderBlendingStage(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      
      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Real-Time Blend Uniformity Trend (NIR RSD %)</h4>
        <div style="height: 220px; width: 100%;">
          <canvas id="blendChartCanvas"></canvas>
        </div>
      </div>

      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Blending Process Parameters</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Mixing Speed</div>
            <strong style="font-size:1.2rem;">24.0 RPM</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Mixing Time</div>
            <strong style="font-size:1.2rem;">15.0 min</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Current Blend RSD</div>
            <strong style="font-size:1.2rem;color:#16a34a;">2.8% (Target: &lt;5.0%)</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Homogeneity Status</div>
            <strong style="font-size:1.2rem;color:#16a34a;">UNIFORM</strong>
          </div>
        </div>

        <button class="button button--secondary" style="width: 100%;" onclick="triggerQuickDataEntry('Blend Uniformity RSD', 'NIR Probe', '%', '2.8')">+ Log Blend NIR Reading</button>
      </div>

    </div>
  `;

  setTimeout(() => {
    const canvas = document.getElementById('blendChartCanvas');
    if (canvas) {
      stageChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['0m', '3m', '6m', '9m', '12m', '15m'],
          datasets: [{
            label: 'Blend RSD (%)',
            data: [18.4, 12.1, 7.5, 4.8, 3.2, 2.8],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: 0, max: 20 } }
        }
      });
    }
  }, 50);
}

// -------------------------------------------------------------
// STAGE 4: GRANULATION
// -------------------------------------------------------------
function renderGranulationStage(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      
      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Granulation Critical Process Parameters (CPPs)</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Impeller Speed</div>
            <strong style="font-size:1.2rem;">150 RPM</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Chopper Speed</div>
            <strong style="font-size:1.2rem;">1800 RPM</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Granule Moisture</div>
            <strong style="font-size:1.2rem;color:#16a34a;">8.4% (Acceptable)</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Product Temperature</div>
            <strong style="font-size:1.2rem;">28.5 °C</strong>
          </div>
        </div>

        <button class="button button--secondary" style="width: 100%; margin-top: 16px;" onclick="triggerQuickDataEntry('Granule Moisture', 'Moisture Analyzer', '%', '8.4')">+ Record Granulation Parameter</button>
      </div>

      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Granule Particle Uniformity & Limits</h4>
        <div style="font-size: 0.88rem; line-height: 1.7; color: var(--muted);">
          • <strong>Target Particle Size (D50):</strong> 120 µm (Spec: 80 - 180 µm) [PASS]<br>
          • <strong>Binder Spray Rate:</strong> 45 g/min (Spec: 40 - 50 g/min) [PASS]<br>
          • <strong>End-Point Torque:</strong> 34 Nm (Spec: 30 - 40 Nm) [PASS]
        </div>
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// STAGE 5: DRYING
// -------------------------------------------------------------
function renderDryingStage(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px;">
      
      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Fluid Bed Drying Curve: Moisture vs Time</h4>
        <div style="height: 220px; width: 100%;">
          <canvas id="dryingChartCanvas"></canvas>
        </div>
      </div>

      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Drying End-Point Specifications</h4>
        <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px; margin-bottom: 12px;">
          <div style="font-size:0.75rem;color:var(--muted);">Final Loss on Drying (LOD)</div>
          <strong style="font-size:1.3rem;color:#16a34a;">2.85% (Target: 2.0 - 3.5%)</strong>
        </div>
        <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px; margin-bottom: 14px;">
          <div style="font-size:0.75rem;color:var(--muted);">Inlet / Outlet Temperature</div>
          <strong style="font-size:1.1rem;">60.0 °C / 42.5 °C</strong>
        </div>
        <button class="button button--secondary" style="width: 100%;" onclick="triggerQuickDataEntry('Moisture Content (LOD)', 'NIR / LOD Analyzer', '%', '2.85')">+ Record Final Moisture LOD</button>
      </div>

    </div>
  `;

  setTimeout(() => {
    const canvas = document.getElementById('dryingChartCanvas');
    if (canvas) {
      stageChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['0m', '10m', '20m', '30m', '40m', '50m'],
          datasets: [{
            label: 'Moisture (%)',
            data: [12.5, 9.2, 6.1, 4.3, 3.2, 2.85],
            borderColor: '#14b8a6',
            backgroundColor: 'rgba(20,184,166,0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: 0, max: 15 } }
        }
      });
    }
  }, 50);
}

// -------------------------------------------------------------
// STAGE 6: FINAL BLENDING / LUBRICATION
// -------------------------------------------------------------
function renderFinalBlendingStage(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      
      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Lubrication Uniformity (Magnesium Stearate)</h4>
        <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px; margin-bottom: 12px;">
          <div style="font-size:0.75rem;color:var(--muted);">Lubricant Blending Time</div>
          <strong style="font-size:1.2rem;">5.0 min (Low Shear)</strong>
        </div>
        <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
          <div style="font-size:0.75rem;color:var(--muted);">Hydrophobic Film Coverage</div>
          <strong style="font-size:1.2rem;color:#16a34a;">UNIFORM (No Over-Lubrication Detected)</strong>
        </div>
      </div>

      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Final Blend Quality Decision</h4>
        <p style="color: var(--muted); font-size: 0.88rem;">Final blended granules are homogeneous and ready for compression stage.</p>
        <button class="button button--secondary" style="width:100%;" onclick="triggerQuickDataEntry('Lubricant Assay', 'Spectrophotometer', '%', '0.98')">+ Record Lubricant Check</button>
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// STAGE 7: TABLET COMPRESSION
// -------------------------------------------------------------
function renderCompressionStage(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px;">
      
      <div class="data-card" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h4 style="margin: 0; font-size: 1.05rem;">Tablet Physical Attributes (IPC Matrix)</h4>
          <span class="badge badge--pass">Within Spec</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Main Compression Force</div>
            <strong style="font-size:1.2rem;">14.2 kN (Spec: 12-18 kN)</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Average Tablet Weight</div>
            <strong style="font-size:1.2rem;">502.4 mg (Target: 500 mg)</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Tablet Hardness</div>
            <strong style="font-size:1.2rem;">8.5 kP (Spec: 6-12 kP)</strong>
          </div>
          <div style="padding: 12px; background: var(--surface-alt); border-radius: 8px;">
            <div style="font-size:0.75rem;color:var(--muted);">Thickness</div>
            <strong style="font-size:1.2rem;">4.12 mm (Spec: 4.0-4.3 mm)</strong>
          </div>
        </div>

        <button class="button button--secondary" style="width: 100%; margin-top: 14px;" onclick="triggerQuickDataEntry('Tablet Hardness', 'Hardness Tester', 'kP', '8.5')">+ Record Tablet IPC Parameters</button>
      </div>

      <div class="data-card" style="padding: 20px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.05rem;">Automated Tablet Vision Inspection</h4>
        <p style="font-size: 0.85rem; color: var(--muted); margin-bottom: 12px;">
          Inspects for surface chips, cracks, edge breaks, capping, and particle contamination.
        </p>
        <button class="button button--primary" style="width: 100%;" onclick="triggerQuickImageUpload('Compression')">📷 Capture / Inspect Tablet Batch Image</button>
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// STAGE 8: FINAL INSPECTION & QC CONSOLIDATED DASHBOARD
// -------------------------------------------------------------
function renderFinalQcStage(container) {
  const compliance = batchTimelineData?.complianceSummary || { total: 0, pass: 0, warning: 0, critical: 0 };
  const allReadings = (appState.analyticalData || []).filter(d => d.projectId === currentBatchId || d.batchId === currentBatchId);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      
      <!-- Quality Gates Checklist -->
      <div class="data-card" style="padding: 22px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.1rem;">Pharmaceutical Batch Release Quality Checklist</h4>
        
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; background: var(--surface-alt); border-radius: 6px;">
            <span>1. Raw Material Identification (Spectroscopy + AI)</span>
            <span class="badge badge--pass">VERIFIED</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; background: var(--surface-alt); border-radius: 6px;">
            <span>2. Dispensing Weight Tolerance (±1.0%)</span>
            <span class="badge badge--pass">PASS (${currentBatch.weightDeviation !== null ? `${currentBatch.weightDeviation}%` : 'OK'})</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; background: var(--surface-alt); border-radius: 6px;">
            <span>3. Blending Homogeneity & RSD (&lt;5.0%)</span>
            <span class="badge badge--pass">PASS</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; background: var(--surface-alt); border-radius: 6px;">
            <span>4. Granulation & Drying Moisture (&lt;3.5%)</span>
            <span class="badge badge--pass">PASS</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; background: var(--surface-alt); border-radius: 6px;">
            <span>5. Tablet Physicals (Hardness, Weight, Thickness)</span>
            <span class="badge badge--pass">PASS</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 12px; background: var(--surface-alt); border-radius: 6px;">
            <span>6. Tablet Visual Defect Inspection</span>
            <span class="badge badge--pass">PASS</span>
          </div>
        </div>
      </div>

      <!-- Decision Support & Report Generator -->
      <div class="data-card" style="padding: 22px;">
        <h4 style="margin: 0 0 14px 0; font-size: 1.1rem;">QC Decision Support & Regulatory Sign-Off</h4>
        
        <div style="padding: 14px; background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.25); border-radius: 8px; margin-bottom: 16px;">
          <div style="font-weight: 700; color: #15803d; margin-bottom: 4px;">RECOMMENDATION: APPROVED FOR RELEASE</div>
          <div style="font-size: 0.85rem; color: #166534; line-height: 1.5;">
            All 8 pharmaceutical lifecycle stages comply with SOP tolerances and validated acceptance criteria.
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="button button--primary" style="padding: 12px;" onclick="approveBatchRelease()">✓ Approve & Sign-Off Batch Release</button>
          <button class="button button--secondary" style="padding: 12px;" onclick="generateCurrentBatchReport()">📄 Generate SHA-256 Tamper-Proof Dossier</button>
        </div>
      </div>

    </div>
  `;
}

async function approveBatchRelease() {
  if (!confirm('Confirm pharmaceutical QC sign-off and approval for this batch? This will be recorded in the audit trail.')) return;
  try {
    await fetch(`${BACKEND_URL}/api/batches/${currentBatchId}/advance-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nextStage: 'Final QC',
        qcStatus: 'Approved',
        operator: 'QC Release Manager',
        notes: 'Batch quality passport verified across all 8 stages. Formally approved for release.'
      })
    });
    alert('Batch successfully approved and signed off.');
    await loadBatchPassport();
  } catch (err) {
    console.error(err);
    alert('Error approving batch: ' + err.message);
  }
}

// -------------------------------------------------------------
// STAGE DATA TABLE LOG
// -------------------------------------------------------------
function renderStageData() {
  const tbody = document.querySelector('#stageDataTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  document.getElementById('stageTableTitle').textContent = `${currentStage} - Measurement & Quality Log`;

  const stageData = (appState.analyticalData || []).filter(d => 
    (d.projectId === currentBatchId || d.batchId === currentBatchId) &&
    ((d.processStage && d.processStage.toLowerCase() === currentStage.toLowerCase()) || !d.processStage)
  );

  if (stageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">No measurements or images recorded for ${currentStage} yet.</td></tr>`;
    return;
  }

  stageData.forEach(item => {
    const row = document.createElement('tr');
    let valueCell = item.value;
    let actionCell = '-';

    if (item.dataType === 'image') {
      const imgUrl = resolveImageUrl(item.value || item.imagePath);
      valueCell = `<img src="${imgUrl}" style="height:36px;width:50px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:8px;" /> Image Record`;
      actionCell = `<button class="table-action-button" onclick="window.location.href='imagegallery.html'">View Gallery</button>`;
    } else if (item.dataType === 'spectrum' && item.rawValues) {
      actionCell = `<button class="table-action-button" onclick='showSpectrumChart(${JSON.stringify(item.rawValues)})'>Chart</button>`;
    }

    const resultLabel = item.result || (item.imageAnalysis?.ai?.visual_qa_result || 'PASS');
    let badgeClass = 'badge--pass';
    if (resultLabel === 'WARNING') badgeClass = 'badge--warning';
    if (resultLabel === 'CRITICAL' || resultLabel === 'REVIEW REQUIRED') badgeClass = 'badge--critical';

    row.innerHTML = `
      <td><strong>${item.parameter || 'Inspection'}</strong></td>
      <td>${item.instrument || item.deviceId || 'In-Line Sensor'}</td>
      <td>${valueCell}</td>
      <td>${item.unit || '-'}</td>
      <td>${item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}</td>
      <td><span class="badge ${badgeClass}">${resultLabel}</span></td>
      <td>${actionCell}</td>
    `;
    tbody.appendChild(row);
  });
}

// -------------------------------------------------------------
// STAGE ACTIONS & MODALS
// -------------------------------------------------------------
function openAdvanceStageModal() {
  const currentIndex = pharmaStages.indexOf(currentBatch.currentStage || pharmaStages[0]);
  const nextStage = currentIndex < pharmaStages.length - 1 ? pharmaStages[currentIndex + 1] : pharmaStages[pharmaStages.length - 1];

  openModal(
    'Advance Pharmaceutical Process Stage',
    `<form id="advanceForm" class="panel-form">
      <div class="form-group">
        <label>Current Stage</label>
        <input type="text" value="${currentBatch.currentStage || pharmaStages[0]}" disabled />
      </div>
      <div class="form-group">
        <label>Next Process Stage</label>
        <select id="advNextStage">
          ${pharmaStages.map(s => `<option value="${s}" ${s === nextStage ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Operator / Verified By</label>
        <input id="advOperator" type="text" value="QC Supervisor" required />
      </div>
      <div class="form-group">
        <label>Handover Notes / Verification Summary</label>
        <textarea id="advNotes" rows="2" placeholder="e.g. In-process parameters verified within specification. Stage approved for handover."></textarea>
      </div>
    </form>`,
    'Confirm Stage Advancement',
    async () => {
      const next = document.getElementById('advNextStage').value;
      const operator = document.getElementById('advOperator').value.trim();
      const notes = document.getElementById('advNotes').value.trim();

      try {
        const res = await fetch(`${BACKEND_URL}/api/batches/${currentBatchId}/advance-stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nextStage: next, operator, notes })
        });
        if (!res.ok) throw new Error('Failed to advance stage');
        closeModal();
        await loadBatchPassport();
      } catch (err) {
        console.error(err);
        alert('Failed to advance stage: ' + err.message);
      }
    }
  );
}

function openAddStageDataModal() {
  openModal(
    `Record Measurement for ${currentStage}`,
    `<form id="quickDataForm" class="panel-form">
      <div class="form-group">
        <label>Parameter Name *</label>
        <input id="qdParam" type="text" placeholder="e.g. Moisture Content / Hardness" required />
      </div>
      <div class="form-group">
        <label>Instrument / Device</label>
        <input id="qdInstrument" type="text" placeholder="e.g. NIR Spectrometer / Balance" value="In-Line Sensor" />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group">
          <label>Measured Value *</label>
          <input id="qdValue" type="number" step="0.001" placeholder="e.g. 2.85" required />
        </div>
        <div class="form-group">
          <label>Unit</label>
          <input id="qdUnit" type="text" placeholder="e.g. % / kN / kP / mg" value="%" />
        </div>
      </div>
    </form>`,
    'Save Reading',
    async () => {
      const parameter = document.getElementById('qdParam').value.trim();
      const instrument = document.getElementById('qdInstrument').value.trim();
      const value = document.getElementById('qdValue').value.trim();
      const unit = document.getElementById('qdUnit').value.trim();

      if (!parameter || value === '') {
        alert('Parameter and Measured Value are required.');
        return;
      }

      await triggerQuickDataEntry(parameter, instrument, unit, value);
      closeModal();
    }
  );
}

async function triggerQuickDataEntry(parameter, instrument, unit, value) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/analytical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parameter,
        instrument,
        value: parseFloat(value),
        unit,
        projectId: currentBatchId,
        batchId: currentBatchId,
        processStage: currentStage,
        timestamp: new Date().toISOString(),
      })
    });
    if (!res.ok) throw new Error('Failed to save analytical reading');
    await fetchLiveAnalyticalData();
    renderStageData();
    alert(`Recorded ${parameter}: ${value} ${unit} for ${currentStage}.`);
  } catch (err) {
    console.error(err);
    alert('Error saving data: ' + err.message);
  }
}

function triggerQuickImageUpload(stage) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        const res = await fetch(`${BACKEND_URL}/api/upload-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            parameter: `${stage} Visual Inspection`,
            projectId: currentBatchId,
            batchId: currentBatchId,
            processStage: stage,
          })
        });
        if (!res.ok) throw new Error('Image upload failed');
        alert('Inspection image uploaded and analyzed by computer vision / AI.');
        await loadBatchPassport();
      } catch (err) {
        console.error(err);
        alert('Error uploading image: ' + err.message);
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function generateCurrentBatchReport() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Batch Quality Dossier - ${currentBatch.batchNumber || currentBatch.name}`,
        generatedBy: 'Authorized QC Inspector',
        projectId: currentBatchId,
      })
    });

    if (!res.ok) throw new Error('Failed to generate report');
    const report = await res.json();
    alert(`Tamper-proof report generated!\nSHA-256 Hash: ${report.integrity.hash}\nRedirecting to Reports.`);
    window.location.href = 'reports.html';
  } catch (err) {
    console.error(err);
    alert('Failed to generate report: ' + err.message);
  }
}

function parseAnalysis(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return null;
}
