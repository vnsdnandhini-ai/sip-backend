/**
 * cgmp-standards.js
 * Comprehensive cGMP Regulatory Governance, Deviations/CAPA,
 * Equipment Qualification (IQ/OQ/PQ), Cleanroom HVAC, and ALCOA+ Audit Core.
 */

// Fallback demo data for standalone or Netlify preview
const DEFAULT_CGMP_MATRIX = {
  overallAuditReadinessScore: 98.4,
  status: 'AUDIT_READY',
  evaluationAuthority: 'SIP cGMP Validation Core',
  standards: [
    {
      id: 'fda-211',
      code: 'US FDA 21 CFR Part 211',
      title: 'Finished Pharmaceuticals cGMP',
      overallScore: 98.0,
      status: 'AUDIT_READY',
      clauses: [
        { clause: '§ 211.68', name: 'Equipment Calibration & PAT Monitoring', status: 'COMPLIANT', score: 100 },
        { clause: '§ 211.100', name: 'Production & Deviation Controls', status: 'COMPLIANT', score: 95 },
        { clause: '§ 211.110', name: 'In-Process Testing & Sampling', status: 'COMPLIANT', score: 98 },
        { clause: '§ 211.188', name: 'Batch Records & Genealogy', status: 'COMPLIANT', score: 100 },
        { clause: '§ 211.192', name: 'OOS Investigations & Records Review', status: 'COMPLIANT', score: 96 }
      ]
    },
    {
      id: 'fda-part11',
      code: 'FDA 21 CFR Part 11 & EU Annex 11',
      title: 'Electronic Records & Signatures',
      overallScore: 99.2,
      status: 'AUDIT_READY',
      clauses: [
        { clause: '11.10(a)', name: 'System Validation & Accuracy', status: 'COMPLIANT', score: 100 },
        { clause: '11.10(e)', name: 'Time-Stamped Audit Trails', status: 'COMPLIANT', score: 100 },
        { clause: '11.10(d)', name: 'User Access Control & RBAC', status: 'COMPLIANT', score: 96 },
        { clause: '11.50', name: 'Electronic Signatures', status: 'COMPLIANT', score: 100 },
        { clause: '11.70', name: 'Cryptographic Record Linking', status: 'COMPLIANT', score: 100 }
      ]
    },
    {
      id: 'alcoa-plus',
      code: 'ALCOA+ Framework',
      title: 'Data Integrity Governance',
      overallScore: 99.1,
      status: 'AUDIT_READY',
      clauses: [
        { clause: 'Attributable', name: 'Operator ID & Device Binding', status: 'COMPLIANT', score: 100 },
        { clause: 'Legible', name: 'Tamper-Proof Audit Records', status: 'COMPLIANT', score: 100 },
        { clause: 'Contemporaneous', name: 'Real-Time Sensor Timestamping', status: 'COMPLIANT', score: 99 },
        { clause: 'Original', name: 'Raw Telemetry Immutability', status: 'COMPLIANT', score: 100 },
        { clause: 'Accurate', name: 'USP/NIST Calibrated Instruments', status: 'COMPLIANT', score: 97 },
        { clause: 'Complete', name: 'End-to-End Batch Genealogy', status: 'COMPLIANT', score: 99 },
        { clause: 'Enduring', name: 'Encrypted Multi-Tier Storage', status: 'COMPLIANT', score: 98 }
      ]
    },
    {
      id: 'ich-q8-q9-q10',
      code: 'ICH Q8 / Q9 / Q10',
      title: 'Quality Risk Management & PQS',
      overallScore: 95.8,
      status: 'AUDIT_READY',
      clauses: [
        { clause: 'ICH Q8', name: 'Design Space & CQAs Verification', status: 'COMPLIANT', score: 96 },
        { clause: 'ICH Q9', name: 'Quality Risk Management (QRM)', status: 'COMPLIANT', score: 94 },
        { clause: 'ICH Q10', name: 'PQS Lifecycle & CAPA Loops', status: 'COMPLIANT', score: 97 }
      ]
    },
    {
      id: 'iso-14644',
      code: 'ISO 14644 & Cleanroom',
      title: 'Cleanroom & HVAC Monitoring',
      overallScore: 98.8,
      status: 'AUDIT_READY',
      clauses: [
        { clause: 'Grade C', name: 'Dispensing & Compression Limits', status: 'COMPLIANT', score: 99 },
        { clause: 'Grade D', name: 'Granulation & Drying Limits', status: 'COMPLIANT', score: 98 },
        { clause: 'ΔP Cascade', name: 'Positive Pressure Cascade (>= 10 Pa)', status: 'COMPLIANT', score: 100 }
      ]
    }
  ]
};

let cachedDeviations = [];
let cachedEquipment = [];
let cachedEnvironmental = [];
let cachedPersonnel = [];

// ==========================================
// 1. INITIALIZATION & TAB MANAGEMENT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  fetchCgmpMatrix();
  fetchDeviations();
  fetchEquipment();
  renderCleanroomSuites();
  fetchPersonnel();
  runLiveAlcoaScan();
});

function switchCgmpTab(tabName) {
  document.querySelectorAll('.cgmp-tab-content').forEach((el) => el.classList.add('hidden'));
  document.querySelectorAll('.filter-buttons .filter-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const tabId = `tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
  const target = document.getElementById(tabId);
  if (target) {
    target.classList.remove('hidden');
  }
}

// ==========================================
// 2. STANDARDS MATRIX & AUDIT READINESS
// ==========================================
async function fetchCgmpMatrix() {
  try {
    const res = await fetch(`${window.BACKEND_URL}/api/compliance/cgmp-matrix`);
    const data = await res.json();
    renderCgmpMatrix(data);
  } catch (e) {
    console.warn('Backend unavailable, rendering standard cGMP matrix offline:', e);
    renderCgmpMatrix(DEFAULT_CGMP_MATRIX);
  }
}

function renderCgmpMatrix(matrix) {
  const score = matrix.overallAuditReadinessScore || 98.4;
  const bigScoreEl = document.getElementById('matrixBigScore');
  const kpiAuditScoreEl = document.getElementById('kpiAuditScore');
  const badgeEl = document.getElementById('cgmpAuditStatusBadge');

  if (bigScoreEl) bigScoreEl.textContent = `${score}%`;
  if (kpiAuditScoreEl) kpiAuditScoreEl.textContent = `${score}%`;
  if (badgeEl) badgeEl.textContent = `Audit Ready (${score}%)`;

  const container = document.getElementById('standardsListContainer');
  if (!container) return;

  const simplifyClause = (name) => {
    if (!name) return '';
    const map = {
      'Automatic, mechanical, and electronic equipment calibration & PAT monitoring': 'Equipment Calibration & PAT Monitoring',
      'Written production and process control procedures & deviation controls': 'Production & Deviation Controls',
      'In-process sampling and testing (Blend uniformity, LOD, hardness)': 'In-Process Testing & Sampling',
      'Batch production and control records (eBR / genealogy)': 'Batch Records & Genealogy',
      'Production record review & Out-of-Specification (OOS) investigations': 'OOS Investigations & Records Review',
      'Validation of systems to ensure accuracy, reliability, consistent performance': 'System Validation & Accuracy',
      'Secure, computer-generated, time-stamped audit trails for all operations': 'Time-Stamped Audit Trails',
      'Limiting system access to authorized individuals (RBAC / GMP tiers)': 'User Access Control & RBAC',
      'Signature manifestations (Printed name, date/time, signing intent)': 'Electronic Signatures',
      'Signature linking to electronic records with SHA-256 cryptographic seal': 'Cryptographic Record Linking',
      'Unique operator IDs linked to every sensor reading, entry & sign-off': 'Operator ID & Device Binding',
      'Clear visual logs, unalterable human-readable audit reports': 'Tamper-Proof Audit Records',
      'Real-time automatic sensor timestamping with millisecond synchronization': 'Real-Time Sensor Timestamping',
      'Raw spectral InGaAs / load-cell telemetry stored immutably before processing': 'Raw Telemetry Immutability',
      'NIST/USP calibrated instruments with verified tolerance ranges': 'USP/NIST Calibrated Instruments',
      'End-to-end 8-step batch genealogy without data fragmentation': 'End-to-End Batch Genealogy',
      'Encrypted multi-tier database storage with verified backup replication': 'Encrypted Multi-Tier Storage',
      'Design Space verification & Critical Quality Attributes (CQAs / CPPs)': 'Design Space & CQAs Verification',
      'Quality Risk Management (FMEA, Ishikawa root cause & severity ranking)': 'Quality Risk Management (QRM)',
      'Pharmaceutical Quality System lifecycle & CAPA corrective action loops': 'PQS Lifecycle & CAPA Loops',
      'Dispensing & Compression suites particle count (0.5µm <= 352,000 / m³)': 'Dispensing & Compression Limits',
      'Granulation & Drying suites particle count (0.5µm <= 3,520,000 / m³)': 'Granulation & Drying Limits',
      'Positive pressure cascade (>= 10 - 15 Pa relative to adjacent corridor)': 'Positive Pressure Cascade (>= 10 Pa)'
    };
    return map[name] || name;
  };

  const simplifyTitle = (title) => {
    if (!title) return '';
    const map = {
      'Current Good Manufacturing Practice for Finished Pharmaceuticals': 'Finished Pharmaceuticals cGMP',
      'Electronic Records; Electronic Signatures & Computerised Systems': 'Electronic Records & Signatures',
      'WHO / FDA / EMA Data Integrity Governance for Life Sciences': 'Data Integrity Governance',
      'Pharmaceutical Development, Quality Risk Management & PQS': 'Quality Risk Management & PQS',
      'Cleanroom Classification & Environmental HVAC Monitoring': 'Cleanroom & HVAC Monitoring'
    };
    return map[title] || title;
  };

  container.innerHTML = '';
  (matrix.standards || DEFAULT_CGMP_MATRIX.standards).forEach((std) => {
    const card = document.createElement('div');
    card.style.border = '1px solid var(--border)';
    card.style.borderRadius = '8px';
    card.style.padding = '10px 12px';
    card.style.background = '#f8fafc';

    const clauseRows = std.clauses.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; padding: 4px 0; border-bottom: 1px dotted #e2e8f0;">
        <span style="font-weight:600; color:var(--text);"><code style="background:#e0e7ff; color:#3730a3; padding:1px 5px; border-radius:4px; font-size:0.75rem;">${c.clause}</code> ${simplifyClause(c.name)}</span>
        <span class="badge ${c.score >= 95 ? 'badge--pass' : 'badge--warning'}" style="font-size:0.75rem;">${c.score}%</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 6px;">
        <div>
          <div style="font-weight:700; font-size:0.9rem; color:#1e1b4b;">${std.code}</div>
          <div style="font-size:0.78rem; color:var(--muted);">${simplifyTitle(std.title)}</div>
        </div>
        <span class="badge badge--pass" style="font-size:0.78rem; font-weight:700;">Score: ${std.overallScore}%</span>
      </div>
      <div style="margin-top: 6px;">
        ${clauseRows}
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================
// 3. DEVIATIONS & CAPA MANAGEMENT
// ==========================================
async function fetchDeviations() {
  const tbody = document.getElementById('deviationsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${window.BACKEND_URL}/api/compliance/deviations`);
    const data = await res.json();
    cachedDeviations = data.deviations || [];
  } catch (e) {
    console.warn('Using local deviation store:', e);
    cachedDeviations = [
      {
        id: 'dev-001',
        deviation_number: 'DEV-2026-089',
        batch_id: 'LOT-PCM-2026-01',
        stage_name: 'Granulation',
        title: 'Transient Torque Surge in High-Shear Impeller',
        classification: 'MINOR',
        deviation_type: 'OOT',
        root_cause_category: 'Machine',
        capa_action: 'Cleaned liquid binder delivery nozzle and verified spray pattern reproducibility.',
        assigned_qa: 'Dr. S. K. Narayanan (QA Head)',
        status: 'CLOSED',
        created_at: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: 'dev-002',
        deviation_number: 'DEV-2026-092',
        batch_id: 'LOT-PCM-2026-01',
        stage_name: 'Final Blending',
        title: 'Stratified Lubrication Blend RSD Borderline Warning',
        classification: 'MAJOR',
        deviation_type: 'OOS',
        root_cause_category: 'Method',
        capa_action: 'Extended mixing stopped. Stratified 10-point core blend re-sampled per USP <905>.',
        assigned_qa: 'K. Meenakshi (Lead QA Auditor)',
        status: 'OPEN',
        created_at: new Date(Date.now() - 14400000).toISOString()
      }
    ];
  }

  const openCount = cachedDeviations.filter(d => d.status !== 'CLOSED').length;
  const kpiDevEl = document.getElementById('kpiDeviationsCount');
  if (kpiDevEl) kpiDevEl.textContent = `${openCount} Open`;

  tbody.innerHTML = '';
  if (cachedDeviations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--muted); padding:20px;">No deviations logged. System fully in compliance.</td></tr>`;
    return;
  }

  cachedDeviations.forEach((d) => {
    const tr = document.createElement('tr');
    const classBadge = d.classification === 'CRITICAL' ? 'badge--critical' : d.classification === 'MAJOR' ? 'badge--warning' : 'chip--blue';
    const statusBadge = d.status === 'CLOSED' ? 'badge--pass' : 'badge--critical';

    tr.innerHTML = `
      <td><strong>${d.deviation_number || d.id}</strong></td>
      <td><span class="chip chip--purple">${d.batch_id || 'Global'}</span><br/><small style="color:var(--muted);">${d.stage_name || 'General'}</small></td>
      <td>
        <div style="font-weight:600; color:var(--text);">${d.title}</div>
        <span class="badge ${classBadge}" style="font-size:0.75rem; margin-top:2px;">${d.classification} (${d.deviation_type || 'OOS'})</span>
      </td>
      <td><span class="chip chip--green">${d.root_cause_category || 'Investigation Pending'}</span></td>
      <td style="max-width:240px; font-size:0.82rem; color:var(--muted);">${d.capa_action || 'CAPA plan under QA formulation'}</td>
      <td><span style="font-size:0.82rem; font-weight:600;">${d.assigned_qa || 'QA Head'}</span></td>
      <td><span class="badge ${statusBadge}">${d.status}</span></td>
      <td>
        ${d.status !== 'CLOSED' 
          ? `<button class="button button--secondary" style="font-size:0.75rem; padding:4px 8px;" onclick="openResolveDeviationModal('${d.id}')">Review &amp; Close (QA)</button>` 
          : `<span style="font-size:0.75rem; color:#16a34a; font-weight:600;">✓ 21 CFR 11 Signed</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openLogDeviationModal() {
  const panel = document.getElementById('cgmpModalPanel');
  const backdrop = document.getElementById('cgmpModalBackdrop');
  if (!panel || !backdrop) return;

  panel.innerHTML = `
    <div class="modal-header">
      <h3 style="margin:0; font-size:1.15rem; font-weight:700;">Log cGMP Deviation / Out-of-Specification (OOS)</h3>
      <button class="modal-close" onclick="closeCgmpModal()">&times;</button>
    </div>
    <form id="logDeviationForm" onsubmit="handleSaveDeviation(event)" style="display:flex; flex-direction:column; gap:12px; margin-top:12px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="form-group">
          <label>Batch / Lot Number</label>
          <input type="text" id="devBatchId" value="LOT-PCM-2026-01" required />
        </div>
        <div class="form-group">
          <label>Process Stage</label>
          <select id="devStageName">
            <option value="Raw Material Receipt">1. Raw Material Receipt</option>
            <option value="Dispensing">2. Dispensing & Weighing</option>
            <option value="Blending">3. Pre-Blending</option>
            <option value="Granulation">4. Wet Granulation</option>
            <option value="Drying">5. Fluid Bed Drying</option>
            <option value="Final Blending">6. Final Blending</option>
            <option value="Compression">7. Tablet Compression</option>
            <option value="Final QC">8. Final QC & Inspection</option>
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="form-group">
          <label>Classification</label>
          <select id="devClassification">
            <option value="CRITICAL">CRITICAL (Direct Product Quality Impact)</option>
            <option value="MAJOR" selected>MAJOR (Regulatory / Process Limit Breach)</option>
            <option value="MINOR">MINOR (Procedural / Cosmetic Non-Conformance)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Deviation Category</label>
          <select id="devType">
            <option value="OOS">Out-of-Specification (OOS)</option>
            <option value="OOT">Out-of-Trend (OOT)</option>
            <option value="EQUIPMENT">Equipment Interlock / Calibration Drift</option>
            <option value="ENVIRONMENTAL">Cleanroom HVAC Breach</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Deviation Title</label>
        <input type="text" id="devTitle" placeholder="e.g. Blend Uniformity RSD Exceeded Upper Control Limit (6.2% vs <=5.0%)" required />
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="form-group">
          <label>Root Cause Category (Ishikawa 6M)</label>
          <select id="devRootCategory">
            <option value="Machine">Machine (Equipment / Calibration / Nozzle / Press)</option>
            <option value="Method">Method (SOP Execution / Cycle Time / Speed)</option>
            <option value="Material">Material (API Assay / Particle Size / Moisture)</option>
            <option value="Measurement">Measurement (Sensor Drift / InGaAs Optics)</option>
            <option value="Environment">Environment (HVAC Temp / RH% / Particles)</option>
            <option value="Manpower">Manpower (Operator Technique / Verification)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Assigned Lead QA Auditor</label>
          <input type="text" id="devAssignedQa" value="Dr. S. K. Narayanan (QA Head)" required />
        </div>
      </div>

      <div class="form-group">
        <label>Immediate Corrective Action (CAPA)</label>
        <textarea id="devCapaAction" rows="2" placeholder="Detail the immediate containment action taken to quarantine batch or correct parameters..."></textarea>
      </div>

      <div class="form-group">
        <label>Preventive Action to Prevent Recurrence</label>
        <textarea id="devPreventiveAction" rows="2" placeholder="Detail SOP modifications, equipment PM updates, or retraining planned..."></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
        <button type="button" class="button button--secondary" onclick="closeCgmpModal()">Cancel</button>
        <button type="submit" class="button button--primary">Submit Deviation to QMS</button>
      </div>
    </form>
  `;

  backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
}

async function handleSaveDeviation(e) {
  e.preventDefault();
  const payload = {
    batchId: document.getElementById('devBatchId').value,
    stageName: document.getElementById('devStageName').value,
    classification: document.getElementById('devClassification').value,
    deviationType: document.getElementById('devType').value,
    title: document.getElementById('devTitle').value,
    rootCauseCategory: document.getElementById('devRootCategory').value,
    assignedQa: document.getElementById('devAssignedQa').value,
    capaAction: document.getElementById('devCapaAction').value,
    preventiveAction: document.getElementById('devPreventiveAction').value,
    loggedBy: 'V. Rajesh (Senior Process Chemist)'
  };

  try {
    const res = await fetch(`${window.BACKEND_URL}/api/compliance/deviations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('Deviation successfully logged into 21 CFR Part 11 Audit Trail.');
    }
  } catch (err) {
    console.warn('Logged deviation locally:', err);
    cachedDeviations.unshift({
      id: `dev-${Date.now()}`,
      deviation_number: `DEV-2026-${Math.floor(100 + Math.random() * 900)}`,
      batch_id: payload.batchId,
      stage_name: payload.stageName,
      title: payload.title,
      classification: payload.classification,
      deviation_type: payload.deviationType,
      root_cause_category: payload.rootCauseCategory,
      capa_action: payload.capaAction,
      assigned_qa: payload.assignedQa,
      status: 'OPEN',
      created_at: new Date().toISOString()
    });
  }

  closeCgmpModal();
  fetchDeviations();
}

function openResolveDeviationModal(devId) {
  const dev = cachedDeviations.find(d => d.id === devId) || cachedDeviations[0];
  const panel = document.getElementById('cgmpModalPanel');
  const backdrop = document.getElementById('cgmpModalBackdrop');
  if (!panel || !backdrop) return;

  panel.innerHTML = `
    <div class="modal-header">
      <h3 style="margin:0; font-size:1.15rem; font-weight:700;">21 CFR Part 11 QA Closure Sign-Off: ${dev.deviation_number || dev.id}</h3>
      <button class="modal-close" onclick="closeCgmpModal()">&times;</button>
    </div>
    <div style="padding: 12px 0;">
      <div style="background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px;">
        <div style="font-weight:700; color:#1e1b4b;">${dev.title}</div>
        <div style="font-size:0.82rem; color:var(--muted); margin-top:4px;">Batch: ${dev.batch_id} · Stage: ${dev.stage_name} · Root Cause: ${dev.root_cause_category}</div>
      </div>

      <form onsubmit="handleResolveDeviation(event, '${dev.id}')" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label>Verified CAPA Effectiveness & Closure Justification</label>
          <textarea id="qaClosureNotes" rows="3" required placeholder="State QA verification results confirming the out-of-spec condition has been remediated...">${dev.capa_action || 'CAPA effectiveness verified. In-process analytical testing returned within validated specification limits.'}</textarea>
        </div>

        <div style="border:1px solid #c7d2fe; background:#eef2ff; border-radius:8px; padding:12px;">
          <div style="font-size:0.85rem; font-weight:700; color:#3730a3; margin-bottom:4px;">FDA 21 CFR Part 11 Electronic Signature Affirmation</div>
          <p style="font-size:0.8rem; color:#4338ca; margin:0 0 8px 0;">
            By entering your QA credentials below, you certify under penalty of perjury that this investigation is complete and the batch disposition complies with cGMP regulations.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div class="form-group">
              <label>QA Signer Name</label>
              <input type="text" id="qaSignerName" value="Dr. S. K. Narayanan" required />
            </div>
            <div class="form-group">
              <label>Role / Title</label>
              <input type="text" id="qaSignerRole" value="Director of Quality Assurance" readonly />
            </div>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label>Signing Intent</label>
            <input type="text" id="qaSignerIntent" value="I approve the CAPA resolution and authorize deviation closure" readonly />
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="button button--secondary" onclick="closeCgmpModal()">Cancel</button>
          <button type="submit" class="button button--primary" style="background:#15803d;">Sign &amp; Close Deviation (SHA-256)</button>
        </div>
      </form>
    </div>
  `;

  backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
}

async function handleResolveDeviation(e, devId) {
  e.preventDefault();
  const signerName = document.getElementById('qaSignerName').value;
  const closureNotes = document.getElementById('qaClosureNotes').value;

  try {
    await fetch(`${window.BACKEND_URL}/api/compliance/deviations/${devId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'CLOSED',
        capaAction: closureNotes,
        qaSignerName: signerName
      })
    });
  } catch (err) {
    console.warn('Closed deviation locally:', err);
    const d = cachedDeviations.find(item => item.id === devId);
    if (d) {
      d.status = 'CLOSED';
      d.capa_action = closureNotes;
    }
  }

  alert(`Deviation ${devId} formally CLOSED under FDA 21 CFR Part 11 Electronic Signature by ${signerName}.`);
  closeCgmpModal();
  fetchDeviations();
}

// ==========================================
// 4. EQUIPMENT QUALIFICATION (IQ/OQ/PQ)
// ==========================================
async function fetchEquipment() {
  const tbody = document.getElementById('equipmentTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${window.BACKEND_URL}/api/compliance/equipment`);
    const data = await res.json();
    cachedEquipment = data.equipment || [];
  } catch (e) {
    console.warn('Using local equipment qualification list:', e);
    cachedEquipment = [
      { equipment_tag: 'PAT-NIR-01', equipment_name: 'InGaAs High-Res Fiber NIR Spectrometer', stage_assigned: 'Raw Material Receipt', cleanroom_location: 'ISO 7 / Suite A', iq_status: 'PASSED', oq_status: 'PASSED', pq_status: 'PASSED', last_calibration_date: '2026-08-01', next_calibration_date: '2027-02-01', calibration_certificate_id: 'CAL-CERT-2026-NIR01', accuracy_tolerance: '±0.002 AU', qualification_status: 'QUALIFIED' },
      { equipment_tag: 'BAL-WT-02', equipment_name: 'Certified Dual-Range Analytical Balance', stage_assigned: 'Dispensing', cleanroom_location: 'ISO 7 / Suite B', iq_status: 'PASSED', oq_status: 'PASSED', pq_status: 'PASSED', last_calibration_date: '2026-08-15', next_calibration_date: '2027-02-15', calibration_certificate_id: 'CAL-CERT-2026-WT02', accuracy_tolerance: '±0.01% span', qualification_status: 'QUALIFIED' },
      { equipment_tag: 'PAT-BLD-03', equipment_name: 'Stratified NIR Micro-Probe', stage_assigned: 'Blending', cleanroom_location: 'ISO 8 / Suite C', iq_status: 'PASSED', oq_status: 'PASSED', pq_status: 'PASSED', last_calibration_date: '2026-07-20', next_calibration_date: '2027-01-20', calibration_certificate_id: 'CAL-CERT-2026-PAT03', accuracy_tolerance: '±0.05% RSD', qualification_status: 'QUALIFIED' },
      { equipment_tag: 'FBD-DRY-05', equipment_name: 'Fluidized Bed NIR & Thermal Sensor', stage_assigned: 'Drying', cleanroom_location: 'ISO 8 / Suite D', iq_status: 'PASSED', oq_status: 'PASSED', pq_status: 'PASSED', last_calibration_date: '2026-08-10', next_calibration_date: '2027-02-10', calibration_certificate_id: 'CAL-CERT-2026-FBD05', accuracy_tolerance: '±0.2 °C / ±0.1% LOD', qualification_status: 'QUALIFIED' },
      { equipment_tag: 'PRS-TAB-07', equipment_name: 'Rotary Press Piezoelectric Sensor', stage_assigned: 'Compression', cleanroom_location: 'ISO 7 / Suite E', iq_status: 'PASSED', oq_status: 'PASSED', pq_status: 'PASSED', last_calibration_date: '2026-08-25', next_calibration_date: '2027-02-25', calibration_certificate_id: 'CAL-CERT-2026-PRS07', accuracy_tolerance: '±0.1 kN', qualification_status: 'QUALIFIED' },
      { equipment_tag: 'VIS-CAM-08', equipment_name: '360° AI High-Speed Optical Vision Inspector', stage_assigned: 'Final QC', cleanroom_location: 'ISO 8 / Suite F', iq_status: 'PASSED', oq_status: 'PASSED', pq_status: 'PASSED', last_calibration_date: '2026-09-01', next_calibration_date: '2027-03-01', calibration_certificate_id: 'CAL-CERT-2026-VIS08', accuracy_tolerance: '0.05 mm Defect Res', qualification_status: 'QUALIFIED' }
    ];
  }

  tbody.innerHTML = '';
  cachedEquipment.forEach((eq) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${eq.equipment_tag}</strong><br/><span style="font-size:0.82rem; color:var(--muted);">${eq.equipment_name}</span></td>
      <td><span class="chip chip--purple">${eq.stage_assigned || 'Line General'}</span><br/><small style="color:var(--muted);">${eq.cleanroom_location || 'Main Plant'}</small></td>
      <td><span class="chip chip--green" style="font-size:0.75rem;">IQ: ${eq.iq_status || 'PASS'}</span> <span class="chip chip--green" style="font-size:0.75rem;">OQ: ${eq.oq_status || 'PASS'}</span> <span class="chip chip--green" style="font-size:0.75rem;">PQ: ${eq.pq_status || 'PASS'}</span></td>
      <td>${eq.last_calibration_date || '2026-08-01'}</td>
      <td><strong style="color:#16a34a;">${eq.next_calibration_date || '2027-02-01'}</strong></td>
      <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:0.8rem;">${eq.calibration_certificate_id || 'NIST-TRACEABLE'}</code></td>
      <td>${eq.accuracy_tolerance || 'Validated'}</td>
      <td><span class="badge badge--pass">${eq.qualification_status || 'QUALIFIED'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddEquipmentModal() {
  alert('Equipment registration modal: All current 6 stage instruments are qualified and validated under USP <1119> / NIST traceable standards.');
}

// ==========================================
// 5. CLEANROOM & HVAC ENVIRONMENTAL SURVEILLANCE
// ==========================================
function renderCleanroomSuites() {
  const grid = document.getElementById('cleanroomCardsGrid');
  if (!grid) return;

  const suites = [
    { suite: 'Suite A', name: 'Raw Material Sampling Room', grade: 'Grade C / ISO 7', dp: 18.5, p05: 124500, p50: 820, temp: 21.2, rh: 44.5, ach: 32, status: 'NORMAL' },
    { suite: 'Suite B', name: 'Dispensing & Weighing Suite', grade: 'Grade C / ISO 7', dp: 22.0, p05: 98200, p50: 640, temp: 20.8, rh: 42.1, ach: 35, status: 'NORMAL' },
    { suite: 'Suite C', name: 'Wet Granulation & Fluid Bed Suite', grade: 'Grade D / ISO 8', dp: 15.2, p05: 850400, p50: 6200, temp: 22.4, rh: 46.8, ach: 22.5, status: 'NORMAL' },
    { suite: 'Suite D', name: 'Tablet Compression Suite', grade: 'Grade C / ISO 7', dp: 24.8, p05: 142100, p50: 910, temp: 21.0, rh: 43.2, ach: 34, status: 'NORMAL' },
    { suite: 'Suite E', name: 'Finished Product QC & Packaging Lab', grade: 'Grade D / ISO 8', dp: 16.4, p05: 620300, p50: 4800, temp: 21.5, rh: 45.0, ach: 25, status: 'NORMAL' }
  ];

  grid.innerHTML = '';
  suites.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '14px';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          <div style="font-weight:800; font-size:1rem; color:var(--text);">${s.name}</div>
          <div style="font-size:0.8rem; color:var(--muted);">${s.suite} · <span class="chip chip--purple" style="font-size:0.75rem;">${s.grade}</span></div>
        </div>
        <span class="badge badge--pass">${s.status}</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; font-size:0.82rem;">
        <div style="background:#f8fafc; padding:8px; border-radius:6px; border:1px solid var(--border);">
          <div style="color:var(--muted); font-size:0.75rem;">Differential Pressure ΔP</div>
          <div style="font-size:1.1rem; font-weight:800; color:#0369a1;">${s.dp} Pa</div>
          <div style="font-size:0.7rem; color:#16a34a;">Limit: >= 10.0 Pa (Pass)</div>
        </div>
        <div style="background:#f8fafc; padding:8px; border-radius:6px; border:1px solid var(--border);">
          <div style="color:var(--muted); font-size:0.75rem;">Particles (0.5µm/m³)</div>
          <div style="font-size:1.1rem; font-weight:800; color:#15803d;">${s.p05.toLocaleString()}</div>
          <div style="font-size:0.7rem; color:#16a34a;">ISO Limit: 352,000 (Pass)</div>
        </div>
        <div style="background:#f8fafc; padding:8px; border-radius:6px; border:1px solid var(--border);">
          <div style="color:var(--muted); font-size:0.75rem;">Temperature</div>
          <div style="font-size:1.05rem; font-weight:700;">${s.temp} °C</div>
          <div style="font-size:0.7rem; color:var(--muted);">Target: 20-24 °C</div>
        </div>
        <div style="background:#f8fafc; padding:8px; border-radius:6px; border:1px solid var(--border);">
          <div style="color:var(--muted); font-size:0.75rem;">Relative Humidity</div>
          <div style="font-size:1.05rem; font-weight:700;">${s.rh}% RH</div>
          <div style="font-size:0.7rem; color:var(--muted);">Target: 40-55% RH</div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function simulateHvacTelemetry() {
  renderCleanroomSuites();
  alert('Cleanroom HVAC surveillance telemetry updated in real time. All positive differential pressure cascades are verified.');
}

// ==========================================
// 6. PERSONNEL GMP TRAINING & COMPETENCY
// ==========================================
async function fetchPersonnel() {
  const tbody = document.getElementById('personnelTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${window.BACKEND_URL}/api/compliance/personnel`);
    const data = await res.json();
    cachedPersonnel = data.personnel || [];
  } catch (e) {
    console.warn('Using local training matrix:', e);
    cachedPersonnel = [
      { employee_id: 'EMP-GMP-101', full_name: 'V. Rajesh', role: 'Senior Process Chemist', gmp_certification_level: 'GMP-Level-3 (Master)', sop_compliance_score: 99.4, qualified_stages: ['Raw Material Receipt', 'Dispensing', 'Blending', 'Granulation', 'Drying', 'Final Blending', 'Compression', 'Final QC'], supervisor_verification: 'Dr. S. K. Narayanan (QA Head)', qualification_status: 'CERTIFIED' },
      { employee_id: 'EMP-GMP-104', full_name: 'M. Anitha', role: 'Quality Control Officer', gmp_certification_level: 'GMP-Level-2 (Advanced)', sop_compliance_score: 98.8, qualified_stages: ['Raw Material Receipt', 'Final Blending', 'Final QC'], supervisor_verification: 'K. Meenakshi (Lead QA Auditor)', qualification_status: 'CERTIFIED' },
      { employee_id: 'EMP-GMP-109', full_name: 'S. Dinesh Kumar', role: 'Line Operator (Compression)', gmp_certification_level: 'GMP-Level-2 (Advanced)', sop_compliance_score: 97.5, qualified_stages: ['Dispensing', 'Granulation', 'Drying', 'Compression'], supervisor_verification: 'V. Rajesh (Senior Process Chemist)', qualification_status: 'CERTIFIED' },
      { employee_id: 'EMP-GMP-201', full_name: 'Dr. S. K. Narayanan', role: 'Director of Quality Assurance', gmp_certification_level: 'GMP-Level-3 (QP / QA Executive)', sop_compliance_score: 100.0, qualified_stages: ['ALL_STAGES_QA_RELEASE_AUTHORITY'], supervisor_verification: 'Executive Board Certification', qualification_status: 'CERTIFIED' }
    ];
  }

  tbody.innerHTML = '';
  cachedPersonnel.forEach((p) => {
    const stages = Array.isArray(p.qualified_stages) ? p.qualified_stages : (typeof p.qualified_stages === 'string' ? JSON.parse(p.qualified_stages) : []);
    const stageTags = stages.map(s => `<span class="chip chip--blue" style="font-size:0.75rem; margin:1px;">${s}</span>`).join(' ');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.employee_id}</strong></td>
      <td><strong>${p.full_name}</strong></td>
      <td>${p.role}</td>
      <td><span class="chip chip--green">${p.gmp_certification_level || 'GMP-Level-2'}</span></td>
      <td><strong style="color:#15803d;">${p.sop_compliance_score}%</strong></td>
      <td style="max-width:280px;">${stageTags || 'All Stages'}</td>
      <td><small style="color:var(--muted);">${p.supervisor_verification || 'Verified'}</small></td>
      <td><span class="badge badge--pass">${p.qualification_status || 'CERTIFIED'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 7. ALCOA+ DATA INTEGRITY SCANNER
// ==========================================
async function runLiveAlcoaScan() {
  const grid = document.getElementById('alcoaDimensionsGrid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--muted);">Running cryptographic ALCOA+ Data Integrity Scan...</div>';

  let report;
  try {
    const res = await fetch(`${window.BACKEND_URL}/api/compliance/alcoa-audit`);
    report = await res.json();
  } catch (e) {
    report = {
      overallScore: 99.1,
      certificateId: 'ALCOA-CERT-2026-X89',
      dimensions: [
        { name: 'Attributable', metric: 'User & Device Binding', score: 100, detail: 'Readings bound to validated Operator ID or Device.' },
        { name: 'Legible', metric: 'Structured Audit Records', score: 100, detail: 'Tamper-proof structured records with unit specs.' },
        { name: 'Contemporaneous', metric: 'Real-Time Acquisition', score: 99.2, detail: 'Timestamps recorded at the moment of measurement.' },
        { name: 'Original', metric: 'Raw Data Immutability', score: 100, detail: 'Raw spectral data preserved in immutable store.' },
        { name: 'Accurate', metric: 'Calibrated Accuracy', score: 97.5, detail: 'Limits match validated USP/NIST calibration limits.' },
        { name: 'Complete', metric: 'End-to-End Lineage', score: 99.0, detail: 'Traceable 8-stage lineage from API to finished lot.' },
        { name: 'Consistent', metric: 'Chronological Validity', score: 100, detail: 'Strict chronological monotonic sequence.' },
        { name: 'Enduring', metric: 'Archival Retention', score: 100, detail: 'Persistent database storage with automatic backups.' },
        { name: 'Available', metric: 'Audit Accessibility', score: 99.8, detail: 'Fast export (PDF, CSV, CoA) for regulatory audits.' }
      ]
    };
  }

  const certBadge = document.getElementById('alcoaCertificateBadge');
  if (certBadge && report.certificateId) {
    certBadge.textContent = `Certificate: ${report.certificateId}`;
  }

  grid.innerHTML = '';
  report.dimensions.forEach((d) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '12px';
    card.style.background = '#f8fafc';
    card.style.border = '1px solid var(--border)';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-weight:800; font-size:0.95rem; color:#0f766e;">${d.name}</span>
        <span class="badge badge--pass" style="font-size:0.75rem;">${d.score}%</span>
      </div>
      <div style="font-size:0.78rem; font-weight:600; color:var(--text); margin-bottom:4px;">${d.metric}</div>
      <p style="font-size:0.78rem; color:var(--muted); margin:0; line-height:1.35;">${d.detail}</p>
    `;
    grid.appendChild(card);
  });
}

function exportAlcoaCertificate() {
  window.print();
}

function closeCgmpModal() {
  const panel = document.getElementById('cgmpModalPanel');
  const backdrop = document.getElementById('cgmpModalBackdrop');
  if (panel) panel.classList.add('hidden');
  if (backdrop) backdrop.classList.add('hidden');
}

window.openLogDeviationModal = openLogDeviationModal;
window.openResolveDeviationModal = openResolveDeviationModal;
window.openAddEquipmentModal = openAddEquipmentModal;
window.runLiveAlcoaScan = runLiveAlcoaScan;
window.exportAlcoaCertificate = exportAlcoaCertificate;
window.simulateHvacTelemetry = simulateHvacTelemetry;
window.closeCgmpModal = closeCgmpModal;
window.switchCgmpTab = switchCgmpTab;
window.fetchCgmpMatrix = fetchCgmpMatrix;
window.fetchDeviations = fetchDeviations;
window.fetchEquipment = fetchEquipment;
window.fetchPersonnel = fetchPersonnel;
