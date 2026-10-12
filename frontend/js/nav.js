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
        const parentCollapsible = link.closest('.nav-collapsible');
        if (parentCollapsible) {
          parentCollapsible.classList.add('open');
          const toggle = parentCollapsible.querySelector('.nav-link--parent');
          if (toggle) toggle.setAttribute('aria-expanded', 'true');
        }
      }
    });
  }

  // Update page title
  function updatePageTitle(pageName) {
    const titles = {
      'dashboard': 'Dashboard',
      'batches': 'Medicine & Batch Type',
      'workflow': 'Process Workflow & Monitoring',
      'sensors': 'Sensor Data Entry',
      'devices': 'Sensor Data Entry',
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
      'settings': 'Settings',
      'process-monitoring': 'Live Monitoring'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
      titleEl.textContent = titles[pageName] || 'Dashboard';
    }
  }

  // Always unlock workflow
  const isAuditComplete = true;
  const currentFileName = window.location.pathname.split('/').pop() || 'dashboard.html';
  const currentPg = currentFileName.replace('.html', '');

  // Handle nav clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      // If it is the parent toggle button, let the toggle handler handle it
      if (link.classList.contains('nav-link--parent')) {
        return;
      }
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
        'audit': 'audit.html',
        'process-monitoring': 'process-monitoring.html'
      };
      if (pageMap[page]) {
        window.location.href = pageMap[page];
      }
    });
  });

  // Handle collapsible nav toggles
  document.querySelectorAll('.nav-link--parent').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parentGroup = toggleBtn.closest('.nav-collapsible');
      if (parentGroup) {
        const isOpen = parentGroup.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', isOpen);
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
    'analytical': 'process-monitoring',
    'imagegallery': 'process-monitoring',
    'live-camera': 'process-monitoring',
    'process-monitoring': 'process-monitoring',
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
      sessionStorage.removeItem('auditStepCompleted');
      window.location.href = 'index.html';
    });
  }
})();
