// Navigation helper for multi-page app
(function() {
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
    'projects': 'Projects',
    'monitoring': 'Monitoring Points',
    'parameters': 'Process Parameters',
    'checkout': 'Checkout Conditions',
    'rules': 'Regulatory Rules',
    'onboarding': 'Project Setup Wizard',
    'analytical': 'Analytical Data',
    'gallery': 'Image Gallery',
    'compliance': 'Compliance Engine',
    'reports': 'Reports',
    'audit': 'Audit Trail'
  };
    document.getElementById('pageTitle').textContent = titles[pageName] || 'Dashboard';
  }

  // Handle nav clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const page = link.getAttribute('data-page');
const pageMap = {
        'dashboard': 'dashboard.html',
        'projects': 'projects.html',
        'monitoring': 'monitoring.html',
        'parameters': 'parameters.html',
        'checkout': 'checkout.html',
        'rules': 'rules.html',
        'onboarding': 'onboarding.html',
        'data-entry': 'analytical.html',
        'gallery': 'imagegallery.html',
        'compliance': 'compliance.html',
        'reports': 'reports.html',
        'audit': 'audit.html'
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
    'projects': 'projects',
    'monitoring': 'monitoring',
    'parameters': 'parameters',
    'checkout': 'checkout',
    'rules': 'rules',
    'onboarding': 'onboarding',
    'analytical': 'data-entry',
    'imagegallery': 'gallery',
    'compliance': 'compliance',
    'reports': 'reports',
    'audit': 'audit'
  };

setActiveNav(pageNameMap[currentPage] || 'dashboard');
  updatePageTitle(pageNameMap[currentPage] || 'Dashboard');

  if (currentPage !== 'onboarding') {
    injectFlowStrip(pageNameMap[currentPage] || 'dashboard');
  }

  function injectFlowStrip(currentPageKey) {
    const flowSteps = [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'projects', label: 'Projects' },
      { key: 'monitoring', label: 'Monitoring Points' },
      { key: 'parameters', label: 'Process Parameters' },
      { key: 'checkout', label: 'Compliance Rules' },
      { key: 'data-entry', label: 'Analytical Data' },
      { key: 'compliance', label: 'Compliance Engine' },
      { key: 'reports', label: 'Reports' },
      { key: 'audit', label: 'Audit Trail' },
    ];

    const pageMap = {
      'dashboard': 'dashboard.html',
      'projects': 'projects.html',
      'monitoring': 'monitoring.html',
      'parameters': 'parameters.html',
      'checkout': 'checkout.html',
      'rules': 'rules.html',
      'onboarding': 'onboarding.html',
      'data-entry': 'analytical.html',
      'compliance': 'compliance.html',
      'reports': 'reports.html',
      'audit': 'audit.html'
    };

    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    const strip = document.createElement('div');
    strip.className = 'flow-strip';
    strip.innerHTML = flowSteps.map((step, i) => {
      const isCurrent = step.key === currentPageKey;
      const arrow = i < flowSteps.length - 1 ? '<span class="flow-strip-arrow">&#8594;</span>' : '';
      return `<span class="flow-strip-item ${isCurrent ? 'current' : ''}" data-flow-page="${step.key}">${step.label}</span>${arrow}`;
    }).join('');

    topbar.insertAdjacentElement('afterend', strip);

    strip.querySelectorAll('.flow-strip-item').forEach((item) => {
      item.addEventListener('click', () => {
        const page = item.dataset.flowPage;
        if (pageMap[page]) window.location.href = pageMap[page];
      });
    });
  }

  // Sign out button
  document.getElementById('signOutButton').addEventListener('click', () => {
    localStorage.removeItem('sipState');
    window.location.href = 'index.html';
  });
})();
