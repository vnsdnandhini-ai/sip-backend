// Navigation helper for multi-page app
(function() {
  // Ensure clean standard theme (remove dark-mode class if present)
  document.body.classList.remove('dark-mode');

  // Check session on page load
  if (!localStorage.getItem('sipState')) {
    window.location.href = 'index.html';
    return;
  }

  // Update active nav link based on current page
  function setActiveNav(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-page') === pageName) {
        link.classList.add('active');
      }
    });
  }

  // Update page title
  function updatePageTitle(pageName) {
    const titles = {
      'dashboard': 'Live Monitoring',
      'batches': 'Batch Management',
      'workflow': 'Process Workflow & Monitoring',
      'sensors': 'Sensors & Hardware Topology',
      'devices': 'Sensors & Hardware Topology',
      'monitoring': 'Monitoring Points',
      'parameters': 'Process Parameters',
      'checkout': 'Checkout Conditions',
      'rules': 'Regulatory Rules',
      'onboarding': 'Project Setup Wizard',
      'data-entry': 'Analytical Data',
      'gallery': 'Image Gallery',
      'compliance': 'Compliance Engine',
      'cgmp': 'cGMP & Industrial Standards',
      'reports': 'Quality Reports',
      'audit': 'Audit Log',
      'settings': 'Settings'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
      titleEl.textContent = titles[pageName] || 'Dashboard';
    }
  }

  // Enforce Audit Log Step Completion
  const isAuditComplete = localStorage.getItem('auditStepCompleted') === 'true';
  const currentFileName = window.location.pathname.split('/').pop() || 'dashboard.html';
  const currentPg = currentFileName.replace('.html', '');
  
  // Protect all pages except audit, dashboard, index, settings
  if (!isAuditComplete && !['audit', 'dashboard', 'index', 'settings', ''].includes(currentPg)) {
    alert('Workflow Locked: Please log an initial Audit Event first to unlock the platform.');
    window.location.href = 'audit.html';
    return;
  }

  // Handle nav clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const page = link.getAttribute('data-page');
      if (!isAuditComplete && !['audit', 'dashboard', 'settings'].includes(page)) {
        alert('Workflow Locked: Please complete the Audit Log entry first.');
        return;
      }
      const pageMap = {
        'dashboard': 'dashboard.html',
        'batches': 'batches.html',
        'workflow': 'manufacturing-process.html',
        'sensors': 'sensors.html',
        'devices': 'sensors.html',
        'monitoring': 'monitoring.html',
        'parameters': 'parameters.html',
        'checkout': 'checkout.html',
        'rules': 'rules.html',
        'onboarding': 'onboarding.html',
        'data-entry': 'analytical.html',
        'gallery': 'imagegallery.html',
        'compliance': 'compliance.html',
        'cgmp': 'cgmp-standards.html',
        'reports': 'reports.html',
        'settings': 'settings.html',
        'audit': 'audit.html'
      };
      if (pageMap[page]) {
        window.location.href = pageMap[page];
      }
    });
  });

  // Visually lock nav links
  if (!isAuditComplete) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const p = link.getAttribute('data-page');
      if (!['audit', 'dashboard', 'settings'].includes(p)) {
        link.style.opacity = '0.5';
        link.style.cursor = 'not-allowed';
        link.title = 'Complete Audit Log first';
      }
    });
  }

  // Extract current page from URL
  const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';
  const currentPage = currentFile.replace('.html', '');
  const pageNameMap = {
    'dashboard': 'dashboard',
    'batches': 'batches',
    'batch-details': 'workflow',
    'manufacturing-process': 'workflow',
    'sensors': 'sensors',
    'devices': 'sensors',
    'monitoring': 'monitoring',
    'parameters': 'parameters',
    'checkout': 'checkout',
    'rules': 'rules',
    'onboarding': 'onboarding',
    'analytical': 'data-entry',
    'imagegallery': 'gallery',
    'live-camera': 'gallery',
    'compliance': 'compliance',
    'cgmp-standards': 'cgmp',
    'reports': 'reports',
    'settings': 'settings',
    'audit': 'audit'
  };

  setActiveNav(pageNameMap[currentPage] || 'dashboard');
  updatePageTitle(pageNameMap[currentPage] || 'Dashboard');

  // Sign out button
  const signOutBtn = document.getElementById('signOutButton');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      localStorage.removeItem('sipState');
      localStorage.removeItem('auditStepCompleted');
      window.location.href = 'index.html';
    });
  }
})();


