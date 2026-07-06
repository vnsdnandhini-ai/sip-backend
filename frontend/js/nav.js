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
      'analytical': 'Analytical Data',
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
        'data-entry': 'analytical.html',
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
    'analytical': 'data-entry',
    'compliance': 'compliance',
    'reports': 'reports',
    'audit': 'audit'
  };

  setActiveNav(pageNameMap[currentPage] || 'dashboard');
  updatePageTitle(pageNameMap[currentPage] || 'Dashboard');

  // Sign out button
  document.getElementById('signOutButton').addEventListener('click', () => {
    localStorage.removeItem('sipState');
    window.location.href = 'index.html';
  });
})();
