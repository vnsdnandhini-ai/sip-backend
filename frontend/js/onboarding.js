const wizardSteps = ['project', 'process', 'monitoring', 'parameter', 'device', 'compliance', 'summary'];
const wizardLabels = {
  project: 'Project',
  process: 'Process',
  monitoring: 'Monitoring',
  parameter: 'Parameter',
  device: 'Device',
  compliance: 'Compliance',
  summary: 'Summary',
};
let wizardIndex = 0;
let wizardData = {
  projectId: null, projectName: '',
  processType: '',
  monitoringPointId: null, monitoringName: '',
  parameterId: null, parameterName: '',
  deviceId: null, apiKey: null, deviceName: '',
  conditionId: null,
};

function renderWizardSteps() {
  const container = document.getElementById('wizardSteps');
  if (!container) return;
  container.innerHTML = wizardSteps.map((step, i) => {
    const cls = i === wizardIndex ? 'active' : i < wizardIndex ? 'done' : '';
    return `<div class="wizard-step-dot ${cls}">${i + 1}. ${wizardLabels[step]}</div>`;
  }).join('');
}

function showWizardPanel() {
  document.querySelectorAll('.wizard-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.step === wizardSteps[wizardIndex]);
  });
  document.getElementById('wzBackBtn').style.visibility = wizardIndex === 0 ? 'hidden' : 'visible';
  document.getElementById('wzNextBtn').textContent = wizardIndex === wizardSteps.length - 1 ? 'Finish' : 'Next';
  renderWizardSteps();
}

async function wizardSubmitStep() {
  const step = wizardSteps[wizardIndex];

  if (step === 'project') {
    const name = document.getElementById('wzProjectName').value.trim();
    const product = document.getElementById('wzProductName').value.trim();
    const batchNumber = document.getElementById('wzBatchNumber').value.trim();
    const department = document.getElementById('wzDepartment').value.trim();
    if (!name || !product || !batchNumber) {
      alert('Project Name, Product Name, and Batch Number are required.');
      return false;
    }
    const res = await fetch(`${BACKEND_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, product, batchNumber, department, line: '', status: 'Active' }),
    });
    const data = await res.json();
    wizardData.projectId = data.id;
    wizardData.projectName = name;
    return true;
  }

  if (step === 'process') {
    if (!wizardData.processType) {
      alert('Please select a manufacturing process.');
      return false;
    }
    return true;
  }

  if (step === 'monitoring') {
    const name = document.getElementById('wzMonitoringName').value.trim();
    const location = document.getElementById('wzMonitoringLocation').value.trim();
    const frequency = document.getElementById('wzMonitoringFrequency').value.trim();
    if (!name || !location || !frequency) {
      alert('Name, Location, and Sampling Frequency are required.');
      return false;
    }
    const res = await fetch(`${BACKEND_URL}/api/monitoring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, location, frequency, description: `Process: ${wizardData.processType}`, status: 'Active' }),
    });
    const data = await res.json();
    wizardData.monitoringPointId = data.id;
    wizardData.monitoringName = name;
    return true;
  }

  if (step === 'parameter') {
    const name = document.getElementById('wzParameterName').value.trim();
    const instrument = document.getElementById('wzParameterInstrument').value.trim();
    const unit = document.getElementById('wzParameterUnit').value.trim();
    const frequency = document.getElementById('wzParameterFrequency').value.trim();
    if (!name || !instrument || !unit || !frequency) {
      alert('All parameter fields are required.');
      return false;
    }
    const res = await fetch(`${BACKEND_URL}/api/parameters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, instrument, unit, frequency, description: '', monitoringPointId: wizardData.monitoringPointId }),
    });
    const data = await res.json();
    wizardData.parameterId = data.id;
    wizardData.parameterName = name;
    document.getElementById('wzConditionParameter').value = name;
    return true;
  }

  if (step === 'device') {
    if (wizardData.deviceId) return true;
    const name = document.getElementById('wzDeviceName').value.trim();
    const connectionType = document.getElementById('wzConnectionType').value;
    if (!name) {
      alert('Device name is required.');
      return false;
    }
    const res = await fetch(`${BACKEND_URL}/api/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, connectionType, monitoringPointId: wizardData.monitoringPointId }),
    });
    const data = await res.json();
    wizardData.deviceId = data.deviceId;
    wizardData.apiKey = data.apiKey;
    wizardData.deviceName = name;

    document.getElementById('wzDeviceResult').innerHTML = `
      <div class="wizard-credential-box">
        <div><strong>Device ID:</strong> ${data.deviceId}</div>
        <div><strong>API Key:</strong> ${data.apiKey}</div>
      </div>
      <p class="note">Save these — your ESP32 firmware needs them in the <code>x-device-id</code> and <code>x-api-key</code> headers to send data.</p>
    `;
    return true;
  }

  if (step === 'compliance') {
    const parameter = document.getElementById('wzConditionParameter').value.trim();
    const acceptance = document.getElementById('wzConditionAcceptance').value.trim();
    const warning = document.getElementById('wzConditionWarning').value.trim();
    const critical = document.getElementById('wzConditionCritical').value.trim();
    const action = document.getElementById('wzConditionAction').value.trim();
    if (!parameter || !acceptance || !warning || !critical) {
      alert('Parameter and all limits are required.');
      return false;
    }
    const res = await fetch(`${BACKEND_URL}/api/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameter, acceptance, warning, critical, action, monitoringPointId: wizardData.monitoringPointId }),
    });
    const data = await res.json();
    wizardData.conditionId = data.id;
    renderWizardSummary();
    return true;
  }

  return true;
}

function renderWizardSummary() {
  const el = document.getElementById('wizardSummary');
  if (!el) return;
  el.innerHTML = `
    <div class="wizard-summary-item"><span>Project</span><strong>${wizardData.projectName}</strong></div>
    <div class="wizard-summary-item"><span>Process</span><strong>${wizardData.processType}</strong></div>
    <div class="wizard-summary-item"><span>Monitoring Point</span><strong>${wizardData.monitoringName}</strong></div>
    <div class="wizard-summary-item"><span>Parameter</span><strong>${wizardData.parameterName}</strong></div>
    <div class="wizard-summary-item"><span>Device</span><strong>${wizardData.deviceName}</strong></div>
    <div class="wizard-summary-item"><span>Compliance Rule</span><strong>Defined</strong></div>
    <p class="note">Your setup is ready. Go to <strong>Analytical Data</strong> to start sending readings, or <strong>Compliance Engine</strong> to evaluate them.</p>
  `;
}

async function wizardNext() {
  const ok = await wizardSubmitStep();
  if (!ok) return;
  if (wizardIndex < wizardSteps.length - 1) {
    wizardIndex++;
    showWizardPanel();
  } else {
    window.location.href = 'projects.html';
  }
}

function wizardBack() {
  if (wizardIndex > 0) {
    wizardIndex--;
    showWizardPanel();
  }
}

function initWizardProcessChoices() {
  document.querySelectorAll('.process-choice').forEach((choice) => {
    choice.addEventListener('click', () => {
      document.querySelectorAll('.process-choice').forEach((c) => c.classList.remove('selected'));
      choice.classList.add('selected');
      wizardData.processType = choice.dataset.value;
    });
  });
}

function initOnboardingPage() {
  if (!document.getElementById('wizardSteps')) return;
  showWizardPanel();
  initWizardProcessChoices();
  document.getElementById('wzNextBtn').addEventListener('click', wizardNext);
  document.getElementById('wzBackBtn').addEventListener('click', wizardBack);
}

document.addEventListener('DOMContentLoaded', initOnboardingPage);
if (document.readyState !== 'loading') initOnboardingPage();