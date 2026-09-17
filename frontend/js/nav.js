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
      'dashboard': 'Dashboard',
      'batches': 'Batch Management',
      'workflow': 'Process Workflow & Monitoring',
      'sensors': 'Sensors & Hardware Topology',
      'devices': 'Sensors & Hardware Topology',
      'monitoring': 'Monitoring Points',
      'parameters': 'Process Parameters',
      'checkout': 'Checkout Conditions',
      'rules': 'Regulatory Rules',
      'onboarding': 'Project Setup Wizard',
      'analytical': 'Analytical Data',
      'gallery': 'Image Gallery',
      'compliance': 'Compliance Engine',
      'cgmp': 'cGMP & Industrial Standards',
      'reports': 'Reports & Audit',
      'settings': 'Settings'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
      titleEl.textContent = titles[pageName] || 'Dashboard';
    }
  }

  // Handle nav clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const page = link.getAttribute('data-page');
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
        'audit': 'reports.html?tab=audit'
      };
      if (pageMap[page]) {
        window.location.href = pageMap[page];
      }
    });
  });

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
    'audit': 'reports'
  };

  setActiveNav(pageNameMap[currentPage] || 'dashboard');
  updatePageTitle(pageNameMap[currentPage] || 'Dashboard');

  // Sign out button
  const signOutBtn = document.getElementById('signOutButton');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      localStorage.removeItem('sipState');
      window.location.href = 'index.html';
    });
  }
})();
