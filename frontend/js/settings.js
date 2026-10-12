/**
 * Spectroscopic Intelligence Platform (SIP)
 * General & Storage Settings Controller
 */

function initSettingsPage() {
  // Theme & Localization
  const themeModeSelect = document.getElementById('themeModeSelect');
  const dateFormatSelect = document.getElementById('dateFormatSelect');
  const timezoneSelect = document.getElementById('timezoneSelect');
  const defaultLandingPage = document.getElementById('defaultLandingPage');

  // Session & Workflow
  const sessionTimeoutSelect = document.getElementById('sessionTimeoutSelect');
  const refreshRateSelect = document.getElementById('refreshRateSelect');
  const confirmStageAdvanceToggle = document.getElementById('confirmStageAdvanceToggle');

  // Notifications
  const toastAlertToggle = document.getElementById('toastAlertToggle');
  const audioAlertToggle = document.getElementById('audioAlertToggle');
  const emailSummaryToggle = document.getElementById('emailSummaryToggle');

  // Storage & Retention
  const storeOnlyAnomaliesSelect = document.getElementById('storeOnlyAnomaliesSelect');
  const imageCacheLimitSelect = document.getElementById('imageCacheLimitSelect');

  // Buttons & Banners
  const saveBtn = document.getElementById('saveSettingsBtn');
  const notifBanner = document.getElementById('settingsNotification');
  const notifMsg = document.getElementById('settingsNotificationMsg');

  // Default values
  const defaultGeneralSettings = {
    theme: 'light',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Asia/Kolkata',
    landingPage: 'dashboard.html',
    sessionTimeout: '15',
    refreshRate: 10000,
    confirmStageAdvance: true,
    toastAlert: true,
    audioAlert: false,
    emailSummary: true,
    storeOnlyAnomalies: false,
    imageCacheLimit: 50
  };

  // Load from localStorage
  let settings = { ...defaultGeneralSettings };
  try {
    const saved = localStorage.getItem('sipGeneralSettings');
    if (saved) {
      settings = { ...settings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Could not parse sipGeneralSettings:', e);
  }

  // Also check existing theme
  const savedTheme = localStorage.getItem('sipTheme') || settings.theme;
  if (savedTheme) {
    settings.theme = savedTheme;
    document.body.classList.toggle('dark-mode', savedTheme === 'dark');
  }

  // Populate inputs
  if (themeModeSelect) {
    themeModeSelect.value = settings.theme || 'light';
    themeModeSelect.addEventListener('change', () => {
      const isDark = themeModeSelect.value === 'dark';
      document.body.classList.toggle('dark-mode', isDark);
      localStorage.setItem('sipTheme', themeModeSelect.value);
    });
  }

  if (dateFormatSelect && settings.dateFormat) dateFormatSelect.value = settings.dateFormat;
  if (timezoneSelect && settings.timezone) timezoneSelect.value = settings.timezone;
  if (defaultLandingPage && settings.landingPage) defaultLandingPage.value = settings.landingPage;

  if (sessionTimeoutSelect && settings.sessionTimeout) sessionTimeoutSelect.value = settings.sessionTimeout;
  if (refreshRateSelect && settings.refreshRate) refreshRateSelect.value = String(settings.refreshRate);
  if (confirmStageAdvanceToggle) confirmStageAdvanceToggle.checked = settings.confirmStageAdvance !== false;

  if (toastAlertToggle) toastAlertToggle.checked = settings.toastAlert !== false;
  if (audioAlertToggle) audioAlertToggle.checked = settings.audioAlert === true;
  if (emailSummaryToggle) emailSummaryToggle.checked = settings.emailSummary !== false;

  if (storeOnlyAnomaliesSelect) storeOnlyAnomaliesSelect.checked = settings.storeOnlyAnomalies === true;
  if (imageCacheLimitSelect && settings.imageCacheLimit) imageCacheLimitSelect.value = String(settings.imageCacheLimit);

  // Sync backend storage settings
  fetch('http://localhost:3000/api/settings')
    .then(res => res.json())
    .then(data => {
      if (storeOnlyAnomaliesSelect && data.storeOnlyAnomalies !== undefined) {
        storeOnlyAnomaliesSelect.checked = data.storeOnlyAnomalies === true;
      }
    })
    .catch(err => console.log('Backend settings API optional/offline:', err.message));

  // Handle Save Settings
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const updatedSettings = {
        theme: themeModeSelect ? themeModeSelect.value : settings.theme,
        dateFormat: dateFormatSelect ? dateFormatSelect.value : settings.dateFormat,
        timezone: timezoneSelect ? timezoneSelect.value : settings.timezone,
        landingPage: defaultLandingPage ? defaultLandingPage.value : settings.landingPage,
        sessionTimeout: sessionTimeoutSelect ? sessionTimeoutSelect.value : settings.sessionTimeout,
        refreshRate: refreshRateSelect ? parseInt(refreshRateSelect.value, 10) : settings.refreshRate,
        confirmStageAdvance: confirmStageAdvanceToggle ? confirmStageAdvanceToggle.checked : true,
        toastAlert: toastAlertToggle ? toastAlertToggle.checked : true,
        audioAlert: audioAlertToggle ? audioAlertToggle.checked : false,
        emailSummary: emailSummaryToggle ? emailSummaryToggle.checked : true,
        storeOnlyAnomalies: storeOnlyAnomaliesSelect ? storeOnlyAnomaliesSelect.checked : false,
        imageCacheLimit: imageCacheLimitSelect ? parseInt(imageCacheLimitSelect.value, 10) : 50
      };

      // Persist to localStorage
      try {
        localStorage.setItem('sipGeneralSettings', JSON.stringify(updatedSettings));
        localStorage.setItem('sipTheme', updatedSettings.theme);
        
        // Also update sipSettings for any backward compatibility
        const currentSip = JSON.parse(localStorage.getItem('sipSettings') || '{}');
        currentSip.refreshInterval = updatedSettings.refreshRate;
        currentSip.storeOnlyAnomalies = updatedSettings.storeOnlyAnomalies;
        localStorage.setItem('sipSettings', JSON.stringify(currentSip));
      } catch (e) {
        console.error('Error saving settings to localStorage:', e);
      }

      // Sync backend settings if server is available
      if (storeOnlyAnomaliesSelect) {
        fetch('http://localhost:3000/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeOnlyAnomalies: storeOnlyAnomaliesSelect.checked })
        }).catch(err => console.warn('Backend sync error:', err.message));
      }

      // Audit trail record if available
      if (typeof recordAudit === 'function') {
        recordAudit('General system & storage settings updated', 'System Settings');
      }

      // Show clean non-blocking notification banner
      if (notifBanner) {
        if (notifMsg) notifMsg.textContent = '✓ General system and storage settings have been successfully saved and applied.';
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
