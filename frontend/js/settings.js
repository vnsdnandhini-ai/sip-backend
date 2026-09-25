function initSettingsPage() {
  const refreshIntervalSelect = document.getElementById('refreshIntervalSelect');
  const aiEnableSelect = document.getElementById('aiEnableSelect');
  const aiThresholdInput = document.getElementById('aiThresholdInput');
  const contaminationThresholdInput = document.getElementById('contaminationThresholdInput');
  const edgeSensitivityInput = document.getElementById('edgeSensitivityInput');
  const auditLogSelect = document.getElementById('auditLogSelect');
  const saveBtn = document.getElementById('saveSettingsBtn');
  const notifBanner = document.getElementById('settingsNotification');
  const notifMsg = document.getElementById('settingsNotificationMsg');

  // Load current settings from localStorage
  const defaultSettings = {
    refreshInterval: 10000,
    aiEnabled: 'true',
    aiThreshold: 70,
    contaminationThreshold: 3.0,
    edgeSensitivity: 3.0,
    auditLogging: 'true',
  };

  const currentSettings = { ...defaultSettings, ...JSON.parse(localStorage.getItem('sipSettings') || '{}') };

  if (refreshIntervalSelect) refreshIntervalSelect.value = String(currentSettings.refreshInterval || 10000);
  if (aiEnableSelect) aiEnableSelect.value = currentSettings.aiEnabled || 'true';
  if (aiThresholdInput) aiThresholdInput.value = currentSettings.aiThreshold || 70;
  if (contaminationThresholdInput) contaminationThresholdInput.value = currentSettings.contaminationThreshold || 3.0;
  if (edgeSensitivityInput) edgeSensitivityInput.value = currentSettings.edgeSensitivity || 3.0;
  if (auditLogSelect) auditLogSelect.value = currentSettings.auditLogging || 'true';

  const storeOnlyAnomaliesSelect = document.getElementById('storeOnlyAnomaliesSelect');
  
  // Fetch backend settings
  fetch('http://localhost:3000/api/settings')
    .then(res => res.json())
    .then(data => {
      if (storeOnlyAnomaliesSelect && data.storeOnlyAnomalies !== undefined) {
        storeOnlyAnomaliesSelect.checked = data.storeOnlyAnomalies === true;
      }
    })
    .catch(err => console.error('Failed to load backend settings:', err));

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newSettings = {
        refreshInterval: parseInt(refreshIntervalSelect.value, 10),
        aiEnabled: aiEnableSelect.value,
        aiThreshold: parseInt(aiThresholdInput.value, 10),
        contaminationThreshold: parseFloat(contaminationThresholdInput.value),
        edgeSensitivity: parseFloat(edgeSensitivityInput.value),
        auditLogging: auditLogSelect.value,
      };

      localStorage.setItem('sipSettings', JSON.stringify(newSettings));

      // Save backend settings
      if (storeOnlyAnomaliesSelect) {
        fetch('http://localhost:3000/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeOnlyAnomalies: storeOnlyAnomaliesSelect.checked })
        }).catch(err => console.error('Failed to save backend settings:', err));
      }

      // Audit trail record if available
      if (typeof recordAudit === 'function') {
        recordAudit(`Platform settings updated (AI Threshold: ${newSettings.aiThreshold}%, Refresh: ${newSettings.refreshInterval}ms)`, 'System Settings');
      }

      // Show clean non-blocking notification banner
      if (notifBanner) {
        if (notifMsg) notifMsg.textContent = '✓ System and platform settings have been successfully saved and applied.';
        notifBanner.classList.remove('hidden');
        setTimeout(() => {
          notifBanner.classList.add('hidden');
        }, 4000);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettingsPage);
} else {
  initSettingsPage();
}
