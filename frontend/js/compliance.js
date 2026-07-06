function submitAnalyticalData(event) {
  event.preventDefault();
  const parameterId = document.getElementById('dataParameter').value;
  const value = document.getElementById('dataValue').value.trim();
  const timestamp = document.getElementById('dataTimestamp').value;

  if (!parameterId || !value || !timestamp) {
    alert('Please select a parameter, enter a value, and set a timestamp.');
    return;
  }

  const parameter = appState.parameters.find((item) => item.id === parameterId);
  const record = {
    id: generateId(),
    parameter: parameter.name,
    instrument: parameter.instrument,
    value: formatValue(value),
    unit: parameter.unit,
    timestamp: new Date(timestamp).toISOString(),
    result: 'Pending',
  };

  if (!isValidAnalyticalRecord(record)) {
    return;
  }

  appState.analyticalData.push(record);
  recordAudit('Manual Analytical Data Entry', 'Analytical Process Data');
  saveState();
  refreshDataTable();
  refreshDashboard();
  event.target.reset();
  document.getElementById('dataInstrument').value = '';
  document.getElementById('dataUnit').value = '';
}

function isValidAnalyticalRecord(record) {
  if (!record.parameter || !record.instrument || record.value === '' || !record.unit || !record.timestamp) {
    alert('The analytical record has missing fields. Please complete all required values.');
    return false;
  }
  if (Number.isNaN(Number(record.value))) {
    alert('The value must be numeric for process parameter validation.');
    return false;
  }
  if (!record.timestamp || Number.isNaN(new Date(record.timestamp).getTime())) {
    alert('The timestamp is invalid. Use a valid date and time.');
    return false;
  }
  const duplicate = appState.analyticalData.some((item) => item.parameter === record.parameter && item.timestamp === record.timestamp && item.value === record.value);
  if (duplicate) {
    alert('Duplicate analytical record detected. Update the existing entry or change the timestamp.');
    return false;
  }
  return true;
}

function handleCsvUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const rows = e.target.result.trim().split(/\r?\n/);
    const headers = rows.shift().split(',').map((item) => item.trim().toLowerCase());
    const expected = ['parameter', 'instrument', 'value', 'unit', 'timestamp'];
    if (!expected.every((field) => headers.includes(field))) {
      alert('CSV must include headers: parameter, instrument, value, unit, timestamp.');
      return;
    }

    rows.forEach((row) => {
      const cols = row.split(',').map((item) => item.trim());
      const record = {
        id: generateId(),
        parameter: cols[headers.indexOf('parameter')],
        instrument: cols[headers.indexOf('instrument')],
        value: formatValue(cols[headers.indexOf('value')]),
        unit: cols[headers.indexOf('unit')],
        timestamp: new Date(cols[headers.indexOf('timestamp')]).toISOString(),
        result: 'Pending',
      };
      if (isValidAnalyticalRecord(record)) {
        appState.analyticalData.push(record);
      }
    });

    recordAudit('CSV Analytical Data Upload', 'Analytical Process Data');
    saveState();
    refreshDataTable();
    refreshDashboard();
    event.target.value = '';
  };
  reader.readAsText(file);
}

function refreshDataTable() {
  const tbody = document.querySelector('#dataTable tbody');
  if (!tbody) return; // Skip if element doesn't exist on this page
  tbody.innerHTML = '';
  appState.analyticalData.forEach((record) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${record.parameter}</td><td>${record.instrument}</td><td>${record.value}</td><td>${record.unit}</td><td>${new Date(record.timestamp).toLocaleString()}</td><td>${record.result}</td>`;
    tbody.appendChild(row);
  });
}

function executeComplianceEvaluation() {
  if (!appState.analyticalData.length) {
    alert('No analytical data is available for compliance evaluation.');
    return;
  }

  appState.complianceResults = [];
  appState.analyticalData.forEach((record) => {
    const condition = findConditionForParameter(record.parameter);
    const complianceResult = evaluateRecord(record, condition);
    appState.complianceResults.push(complianceResult);
    record.result = complianceResult.outcome;
  });

  recordAudit('Compliance Evaluation Completed', 'Compliance Engine');
  saveState();
  renderComplianceResults();
  refreshDashboard();
}

function findConditionForParameter(parameterName) {
  return appState.checkoutConditions.find((condition) => condition.parameter.toLowerCase() === parameterName.toLowerCase());
}

function evaluateRecord(record, condition) {
  const result = {
    id: record.id,
    parameter: record.parameter,
    value: Number(record.value),
    outcome: 'PASS',
    status: 'Within acceptance',
    action: condition?.action || 'Review defined corrective actions.',
  };

  if (!condition) {
    result.outcome = 'FAIL';
    result.status = 'No checkout condition configured';
    result.action = 'Define checkout condition for this parameter.';
    return result;
  }

  const normalized = record.value;
  const warningValues = parseLimitRange(condition.warning);
  const acceptanceValues = parseLimitRange(condition.acceptance);
  const criticalValues = parseLimitRange(condition.critical);

  if (criticalValues && matchesRange(normalized, criticalValues)) {
    result.outcome = 'FAIL';
    result.status = 'Critical';
    result.action = condition.action || 'Escalate to quality review and stop the batch.';
  } else if (warningValues && matchesRange(normalized, warningValues)) {
    result.outcome = 'FAIL';
    result.status = 'Warning';
    result.action = condition.action || 'Investigate and apply corrective action.';
  } else if (acceptanceValues && matchesRange(normalized, acceptanceValues)) {
    result.outcome = 'PASS';
    result.status = 'Acceptance';
    result.action = 'No action required.';
  } else {
    result.outcome = 'FAIL';
    result.status = 'Out of defined limits';
    result.action = condition.action || 'Review parameter profile and adjust process controls.';
  }
  return result;
}

function parseLimitRange(limitText) {
  if (!limitText) return null;
  const cleaned = limitText.replace(/ /g, '').replace('%', '');
  if (cleaned.includes('-')) {
    const [min, max] = cleaned.split('-').map(Number);
    return { min, max };
  }
  if (cleaned.startsWith('>')) {
    return { min: Number(cleaned.slice(1)), max: Infinity };
  }
  if (cleaned.startsWith('<')) {
    return { min: -Infinity, max: Number(cleaned.slice(1)) };
  }
  const fixed = Number(cleaned);
  return { min: fixed, max: fixed };
}

function matchesRange(value, range) {
  if (typeof value !== 'number' || Number.isNaN(value)) return false;
  return value >= range.min && value <= range.max;
}

function renderComplianceResults() {
  const statusElement = document.getElementById('complianceStatus');
  const passRateElement = document.getElementById('compliancePassRate');
  const deviationsElement = document.getElementById('complianceDeviations');
  const tbody = document.querySelector('#complianceTable tbody');
  tbody.innerHTML = '';

  const failCount = appState.complianceResults.filter((item) => item.outcome === 'FAIL').length;
  const passCount = appState.complianceResults.filter((item) => item.outcome === 'PASS').length;
  const total = appState.complianceResults.length;
  const passRate = total ? Math.round((passCount / total) * 100) : 0;
  const statusText = failCount ? 'Review Required' : 'All records compliant';

  statusElement.textContent = statusText;
  passRateElement.textContent = `${passRate}%`;
  deviationsElement.textContent = failCount;

  appState.complianceResults.forEach((result) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${result.parameter}</td><td>${result.value}</td><td>${result.status}</td><td>${result.outcome}</td><td>${result.action}</td>`;
    tbody.appendChild(row);
  });
}
