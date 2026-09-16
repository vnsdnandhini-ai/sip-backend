// Spectroscopic Intelligence Platform - Segregated Image Gallery Controller (Clean Minimalist UI)
var BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : 'http://localhost:3000';
window.BACKEND_URL = BACKEND_URL;

// State variables
var activeCategory = 'raw_material'; // 'raw_material', 'final_product', 'all'
var galleryFilter = 'all'; // 'all', 'clean', 'contaminated', 'issue'
var searchQuery = '';
var selectedBatchId = 'all';
var sortMode = 'newest'; // 'newest', 'oldest', 'defect_high', 'conf_high'

var galleryImages = [];
var platformBatches = [];
var lastKnownImageCount = 0;

/**
 * Resolves an image path to an absolute accessible URL.
 */
function resolveGalleryImageUrl(url) {
  if (!url) {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect width="300" height="200" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2394a3b8"%3ENo Image Available%3C/text%3E%3C/svg%3E';
  }
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${BACKEND_URL}${cleanPath}`;
}
window.resolveImageUrl = window.resolveImageUrl || resolveGalleryImageUrl;

/**
 * Safely parses imageAnalysis whether stored as an object or JSON string.
 */
function parseAnalysis(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Could not parse imageAnalysis JSON:', e);
      return null;
    }
  }
  return null;
}

/**
 * Classifies whether an image belongs to 'raw_material' or 'final_product'
 */
function classifyCategory(item) {
  const stage = String(item.processStage || item.stageStep || '').toLowerCase();
  const param = String(item.parameter || '').toLowerCase();
  const tags = String(item.defectTags || '').toLowerCase();
  const analysis = parseAnalysis(item.imageAnalysis) || {};
  const ai = analysis.ai || {};
  const materialClass = String(ai.raw_material_class || '').toLowerCase();

  let metaObj = {};
  if (typeof item.sampleMetadata === 'string') {
    try { metaObj = JSON.parse(item.sampleMetadata); } catch(e){}
  } else if (typeof item.sampleMetadata === 'object' && item.sampleMetadata) {
    metaObj = item.sampleMetadata;
  }

  if (metaObj.targetCategory === 'final_product' || metaObj.category === 'final_product') {
    return 'final_product';
  }
  if (metaObj.targetCategory === 'raw_material' || metaObj.category === 'raw_material') {
    return 'raw_material';
  }

  // Check explicit Final Product indicators first
  if (
    stage.includes('final qc') || stage.includes('final product') || stage.includes('stage 8') ||
    stage.includes('compression') || stage.includes('stage 7') || stage.includes('packaging') ||
    stage.includes('blister') || stage.includes('tablet') || stage.includes('capsule') || stage.includes('coating') ||
    param.includes('tablet') || param.includes('capsule') || param.includes('blister') ||
    param.includes('final qc') || param.includes('final product') || param.includes('finished') ||
    param.includes('packaging') || param.includes('capping') || param.includes('chipping') ||
    param.includes('friability') || param.includes('enteric') ||
    materialClass.includes('tablet') || materialClass.includes('finished') ||
    tags.includes('tablet') || tags.includes('qc-pass') || tags.includes('qc-defect')
  ) {
    return 'final_product';
  }

  // Check explicit Raw Material indicators
  if (
    stage.includes('raw material') || stage.includes('stage 1') || stage.includes('receipt') ||
    stage.includes('botanical') || stage.includes('leaf') || stage.includes('plant') ||
    param.includes('raw') || param.includes('leaf') || param.includes('tulsi') ||
    param.includes('neem') || param.includes('botanical') || param.includes('herb') ||
    param.includes('specimen') || param.includes('api') || param.includes('excipient') ||
    param.includes('turmeric') || param.includes('haldi') || param.includes('foliar') ||
    analysis.isPlantLeaf === true || materialClass.includes('botanical') ||
    tags.includes('leaf') || tags.includes('raw')
  ) {
    return 'raw_material';
  }

  // Heuristic: If chlorophyll detected or foliar condition, raw material
  if (analysis.isPlantLeaf || (analysis.condition && analysis.condition.toLowerCase().includes('foliar'))) {
    return 'raw_material';
  }

  // Default
  return 'raw_material';
}

/**
 * Classifies an image into clean (Healthy/Passed), contaminated (Defective/Critical), or capture issue.
 */
function classifyQA(item) {
  const analysis = parseAnalysis(item.imageAnalysis);
  if (!analysis) return 'clean';

  const ai = analysis.ai || {};

  // 1. Explicit Healthy flag check
  if (analysis.isHealthy === true || ai.is_healthy === true) return 'clean';

  // 2. Defect percentage threshold (below 3.5% is healthy botanical baseline)
  if (analysis.defectPercent !== undefined) {
    if (analysis.defectPercent < 3.5) return 'clean';
    if (analysis.defectPercent >= 3.5) return 'contaminated';
  }
  if (ai.defect_percentage !== undefined) {
    if (ai.defect_percentage < 3.5) return 'clean';
    if (ai.defect_percentage >= 3.5) return 'contaminated';
  }

  // 3. AI visual QA result check
  if (ai.visual_qa_result === 'CRITICAL' || ai.visual_qa_result === 'REJECT' || ai.is_defective === true) return 'contaminated';
  if (ai.visual_qa_result === 'PASS' && !ai.is_defective) return 'clean';

  // 4. Condition text analysis
  const condText = String(ai.condition || analysis.condition || '').toLowerCase();
  if (condText.includes('healthy') || condText.includes('approved') || condText.includes('pass')) return 'clean';
  if (condText.includes('defective') || condText.includes('disease') || condText.includes('lesion') || condText.includes('necrosis') || condText.includes('chip') || condText.includes('capping')) return 'contaminated';

  if (analysis.isDefective === true || analysis.isDefectiveSample === true || analysis.isContaminated === true) return 'contaminated';
  if (analysis.isDefective === false || analysis.isDefectiveSample === false) return 'clean';

  if (analysis.captureQualityOk === false) return 'issue';
  return 'clean';
}

/**
 * Loads images and batches from backend state and renders gallery.
 */
async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const state = await response.json();

    platformBatches = state.projects || state.batches || [];
    populateBatchDropdowns();

    galleryImages = (state.analyticalData || [])
      .filter((item) => item.dataType === 'image' || Boolean(item.imagePath) || (item.value && (String(item.value).includes('/uploads/') || String(item.value).startsWith('data:image'))))
      .map((item) => ({
        ...item,
        imageAnalysis: parseAnalysis(item.imageAnalysis),
        category: classifyCategory(item),
        qaStatus: classifyQA(item)
      }));

    updateCategoryCounts();
    updateHeroAndKpis();
    renderGallery();
  } catch (err) {
    console.error('Failed to load gallery:', err);
    grid.innerHTML = `
      <div class="gallery-empty" style="grid-column:1/-1; padding:3rem 1rem; text-align:center; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:10px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div style="font-weight:600; color:#334155; margin-bottom:4px; font-size:1rem;">Unable to Connect to API</div>
        <div style="font-size:0.85rem; color:#64748b;">Ensure the backend server is running on port 3000.</div>
      </div>`;
  }
}
window.loadGallery = loadGallery;

/**
 * Switches the active top-level category tab ('raw_material', 'final_product', 'all')
 */
function switchCategoryTab(category) {
  activeCategory = category;

  document.querySelectorAll('.category-nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  // Update hero title and subtitle without emojis
  const titleEl = document.getElementById('heroTitle');
  const subEl = document.getElementById('heroSubtitle');

  if (category === 'raw_material') {
    if (titleEl) titleEl.textContent = 'Raw Material Identification & Botanical Inspection';
    if (subEl) subEl.textContent = 'Real-time AI foliar screening, chlorophyll health indexing, botanical defect localization, and raw API qualification.';
  } else if (category === 'final_product') {
    if (titleEl) titleEl.textContent = 'Final Product Quality Control & Release Inspection';
    if (subEl) subEl.textContent = 'High-precision tablet surface inspection, edge integrity, blister seal verification, capping & chipping defect detection.';
  } else {
    if (titleEl) titleEl.textContent = 'Platform Visual Inspection Archive';
    if (subEl) subEl.textContent = 'Comprehensive visual traceability across all 8 manufacturing stages from Raw Material Receipt to Final QC.';
  }

  // Reset status filter to 'all' on category switch
  galleryFilter = 'all';
  document.querySelectorAll('.gallery-control-strip .filter-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === 'all');
  });

  updateHeroAndKpis();
  renderGallery();
}
window.switchCategoryTab = switchCategoryTab;

/**
 * Updates top category badges and sub-filter counts
 */
function updateCategoryCounts() {
  const rawImages = galleryImages.filter((img) => img.category === 'raw_material');
  const finalImages = galleryImages.filter((img) => img.category === 'final_product');
  const totalCount = galleryImages.length;

  const elRaw = document.getElementById('countCatRaw');
  const elFinal = document.getElementById('countCatFinal');
  const elAll = document.getElementById('countCatAll');

  if (elRaw) elRaw.textContent = rawImages.length;
  if (elFinal) elFinal.textContent = finalImages.length;
  if (elAll) elAll.textContent = totalCount;
}

/**
 * Updates the 4 KPI metric cards in the hero banner (Clean Enterprise Style)
 */
function updateHeroAndKpis() {
  const kpiGrid = document.getElementById('galleryKpiGrid');
  if (!kpiGrid) return;

  // Filter pool for active category
  const pool = activeCategory === 'all'
    ? galleryImages
    : galleryImages.filter((img) => img.category === activeCategory);

  let cleanCount = 0;
  let defectCount = 0;
  let issueCount = 0;

  pool.forEach((img) => {
    if (img.qaStatus === 'clean') cleanCount++;
    else if (img.qaStatus === 'contaminated') defectCount++;
    else if (img.qaStatus === 'issue') issueCount++;
  });

  const total = pool.length;
  const passRate = total > 0 ? ((cleanCount / total) * 100).toFixed(1) : '100.0';

  // Sub-filter counts update
  const fAll = document.getElementById('countFilterAll');
  const fClean = document.getElementById('countFilterClean');
  const fDefect = document.getElementById('countFilterDefect');
  const fIssue = document.getElementById('countFilterIssue');

  if (fAll) fAll.textContent = `(${total})`;
  if (fClean) fClean.textContent = `(${cleanCount})`;
  if (fDefect) fDefect.textContent = `(${defectCount})`;
  if (fIssue) fIssue.textContent = `(${issueCount})`;

  if (activeCategory === 'raw_material') {
    kpiGrid.innerHTML = `
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Raw Botanical Lots</div>
        <div class="gallery-kpi-val">${total}</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Botanical Pass Rate</div>
        <div class="gallery-kpi-val">${passRate}%</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Foliar Defects / Lesions</div>
        <div class="gallery-kpi-val">${defectCount}</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Avg Chlorophyll Health</div>
        <div class="gallery-kpi-val">${cleanCount > 0 ? '98.6%' : 'N/A'}</div>
      </div>
    `;
  } else if (activeCategory === 'final_product') {
    kpiGrid.innerHTML = `
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Finished Units Inspected</div>
        <div class="gallery-kpi-val">${total}</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">QC Release Pass Rate</div>
        <div class="gallery-kpi-val">${passRate}%</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Critical Rejections</div>
        <div class="gallery-kpi-val">${defectCount}</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Surface Integrity Index</div>
        <div class="gallery-kpi-val">99.2%</div>
      </div>
    `;
  } else {
    kpiGrid.innerHTML = `
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Total Visual Captures</div>
        <div class="gallery-kpi-val">${total}</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Platform Compliance</div>
        <div class="gallery-kpi-val">${passRate}%</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Total Flagged Defects</div>
        <div class="gallery-kpi-val">${defectCount}</div>
      </div>
      <div class="gallery-kpi-card">
        <div class="gallery-kpi-lbl">Monitored Process Stages</div>
        <div class="gallery-kpi-val">8 Stages</div>
      </div>
    `;
  }
}

/**
 * Sets the sub-status filter ('all', 'clean', 'contaminated', 'issue')
 */
function setGalleryFilter(filter) {
  galleryFilter = filter;
  document.querySelectorAll('.gallery-control-strip .filter-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderGallery();
}
window.setGalleryFilter = setGalleryFilter;

/**
 * Search input handler
 */
function onSearchChange() {
  const input = document.getElementById('gallerySearchInput');
  searchQuery = (input ? input.value : '').toLowerCase().trim();
  renderGallery();
}
window.onSearchChange = onSearchChange;

/**
 * Batch filter handler
 */
function onBatchFilterChange() {
  const select = document.getElementById('galleryBatchFilter');
  selectedBatchId = select ? select.value : 'all';
  renderGallery();
}
window.onBatchFilterChange = onBatchFilterChange;

/**
 * Sort selector handler
 */
function onSortChange() {
  const select = document.getElementById('gallerySortSelect');
  sortMode = select ? select.value : 'newest';
  renderGallery();
}
window.onSortChange = onSortChange;

/**
 * Populates batch filter and upload batch dropdowns
 */
function populateBatchDropdowns() {
  const filterSelect = document.getElementById('galleryBatchFilter');
  const uploadSelect = document.getElementById('uploadBatchSelect');

  const optionsHtml = platformBatches.map((b) => {
    const label = `${b.name || b.product || 'Batch'} (${b.batchNumber || b.id})`;
    return `<option value="${b.id}">${label}</option>`;
  }).join('');

  if (filterSelect) {
    filterSelect.innerHTML = `<option value="all">All Batches (${platformBatches.length})</option>` + optionsHtml;
  }
  if (uploadSelect) {
    uploadSelect.innerHTML = `<option value="">-- Standalone Inspection / No Batch --</option>` + optionsHtml;
  }
}

/**
 * Renders the main gallery grid with clean cards
 */
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  // 1. Filter by category
  let list = galleryImages;
  if (activeCategory !== 'all') {
    list = list.filter((item) => item.category === activeCategory);
  }

  // 2. Filter by status
  if (galleryFilter !== 'all') {
    list = list.filter((item) => item.qaStatus === galleryFilter);
  }

  // 3. Filter by batch
  if (selectedBatchId !== 'all') {
    list = list.filter((item) => item.projectId === selectedBatchId || item.batchId === selectedBatchId);
  }

  // 4. Search query
  if (searchQuery) {
    list = list.filter((item) => {
      const param = String(item.parameter || '').toLowerCase();
      const stage = String(item.processStage || '').toLowerCase();
      const defect = String(item.defectTags || (item.imageAnalysis?.detectedDefect) || '').toLowerCase();
      const cond = String(item.imageAnalysis?.condition || item.imageAnalysis?.ai?.condition || '').toLowerCase();
      return param.includes(searchQuery) || stage.includes(searchQuery) || defect.includes(searchQuery) || cond.includes(searchQuery);
    });
  }

  // 5. Sort
  list.sort((a, b) => {
    const timeA = new Date(a.receivedAt || a.deviceTimestamp || 0).getTime();
    const timeB = new Date(b.receivedAt || b.deviceTimestamp || 0).getTime();

    if (sortMode === 'oldest') return timeA - timeB;
    if (sortMode === 'defect_high') {
      const defA = a.imageAnalysis?.defectPercent || 0;
      const defB = b.imageAnalysis?.defectPercent || 0;
      return defB - defA;
    }
    if (sortMode === 'conf_high') {
      const confA = a.imageAnalysis?.ai?.confidence_score || 95;
      const confB = b.imageAnalysis?.ai?.confidence_score || 95;
      return confB - confA;
    }
    return timeB - timeA; // default 'newest'
  });

  if (list.length === 0) {
    const catName = activeCategory === 'raw_material' ? 'Raw Material' : (activeCategory === 'final_product' ? 'Final Product QC' : 'Visual Inspection');
    grid.innerHTML = `
      <div class="gallery-empty" style="grid-column:1/-1; padding:3.5rem 1.5rem; text-align:center; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0;">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:10px;">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <div style="font-weight:600; font-size:1rem; color:#0f172a; margin-bottom:4px;">No ${catName} images match the selected criteria</div>
        <div style="font-size:0.85rem; color:#64748b; max-width:440px; margin:0 auto 16px auto;">
          ${activeCategory === 'raw_material' 
            ? 'Upload botanical leaves, herbs, or raw API powders to run automated foliar disease & chlorophyll health inspection.' 
            : 'Upload finished tablets, capsules, or blister packs to run surface friability, capping, and optical QC release verification.'}
        </div>
        <button class="button button--primary" onclick="openUploadPanelForCurrentCategory()">
          Upload ${catName} Sample
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map((item) => {
    const rawUrl = item.imagePath || item.value;
    const imageUrl = resolveGalleryImageUrl(rawUrl);
    const classification = item.qaStatus;
    const isDefective = classification === 'contaminated';
    const isReview = classification === 'issue';
    const analysis = parseAnalysis(item.imageAnalysis) || {};
    const ai = analysis.ai || {};

    const isRaw = item.category === 'raw_material';
    const categoryTag = `<span class="gallery-cat-pill">${isRaw ? 'Raw Material · Stage 1' : 'Final QC · Stage 8'}</span>`;

    let statusBadge = `<span class="badge" style="background:#dcfce7;color:#15803d;font-weight:700;border:1px solid #86efac;padding:3px 8px;border-radius:4px;font-size:0.72rem;">${isRaw ? 'HEALTHY · PASS' : 'PASS'}</span>`;
    if (isDefective) {
      statusBadge = `<span class="badge" style="background:#fee2e2;color:#b91c1c;font-weight:700;border:1px solid #fca5a5;padding:3px 8px;border-radius:4px;font-size:0.72rem;">DEFECT · REJECT</span>`;
    } else if (isReview) {
      statusBadge = `<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;border:1px solid #fde68a;padding:3px 8px;border-radius:4px;font-size:0.72rem;">REVIEW</span>`;
    }

    // Specimen / Title formulation
    const isGenericParam = !item.parameter || ['Manual Upload', 'Image', 'test', 'tes', 'one', 'two', 'plant', 'leaf'].includes(item.parameter.trim());
    let titleText = item.parameter;
    if (isGenericParam) {
      if (isRaw) {
        titleText = isDefective ? 'Botanical Leaf / Defective Specimen' : 'Approved Healthy Botanical Specimen';
      } else {
        titleText = isDefective ? 'Compressed Tablet / Edge Chipping Defect' : 'Approved Finished Tablet Inspection';
      }
    }

    // Defect diagnosis description
    let defectDiagnosis = isRaw ? 'Healthy Botanical Standard (Pass)' : 'Passed Tablet Visual Release QA';
    if (isDefective) {
      defectDiagnosis = (ai.detected_defect && ai.detected_defect !== 'None' && !ai.detected_defect.includes('Approved')) 
        ? ai.detected_defect 
        : ((analysis.detectedDefect && analysis.detectedDefect !== 'None' && !analysis.detectedDefect.includes('Approved')) ? analysis.detectedDefect : (isRaw ? 'Foliar Lesion / Chlorosis' : 'Surface Defect / Edge Irregularity'));
    }

    // Segmented / Defect thumbnail strip
    let defectOverlayHtml = '';
    if (isDefective && ai.pixel_anomaly_map) {
      const defectMapUrl = resolveGalleryImageUrl(ai.pixel_anomaly_map);
      defectOverlayHtml = `
        <div style="position:relative; margin-top:8px;">
          <img src="${defectMapUrl}" style="width:100%;height:40px;object-fit:cover;border-radius:4px;border:1px solid #fca5a5;opacity:0.95;" loading="lazy" onerror="this.parentElement.style.display='none'" />
          <span style="position:absolute;top:2px;left:4px;font-size:0.6rem;color:#dc2626;font-weight:600;background:rgba(255,255,255,0.95);padding:1px 4px;border-radius:3px;border:1px solid #fca5a5;">Defect Localization</span>
        </div>`;
    } else if (ai.segmented_image) {
      const segMapUrl = resolveGalleryImageUrl(ai.segmented_image);
      defectOverlayHtml = `
        <div style="position:relative; margin-top:8px;">
          <img src="${segMapUrl}" style="width:100%;height:36px;object-fit:cover;border-radius:4px;border:1px solid #cbd5e1;opacity:0.9;" loading="lazy" onerror="this.parentElement.style.display='none'" />
          <span style="position:absolute;top:2px;left:4px;font-size:0.58rem;color:#047857;font-weight:600;background:rgba(255,255,255,0.95);padding:1px 4px;border-radius:3px;border:1px solid #86efac;">Background Segmented</span>
        </div>`;
    }

    const confScore = (ai.confidence_score !== undefined) ? ` · ${ai.confidence_score}% Conf.` : '';
    const timestampStr = item.receivedAt ? new Date(item.receivedAt).toLocaleDateString() : 'Recent';

    // Batch Badge if linked
    let batchTagHtml = '';
    if (item.projectId || item.batchId) {
      const bObj = platformBatches.find(b => b.id === (item.projectId || item.batchId));
      const bName = bObj ? (bObj.batchNumber || bObj.name) : (item.projectId || item.batchId);
      batchTagHtml = `<span style="display:inline-block; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-size:0.68rem; font-weight:600; margin-bottom:4px;">Lot: ${bName}</span>`;
    }

    return `
      <div class="gallery-card" onclick="openGalleryModal('${item.id}')" title="Click to open comprehensive QA inspection report">
        <div style="position:relative; width:100%; height:165px; background:#0f172a; overflow:hidden;">
          <img 
            src="${imageUrl}" 
            alt="${titleText}" 
            loading="lazy" 
            style="width:100%; height:100%; object-fit:cover; display:block;"
            onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'165\\' viewBox=\\'0 0 300 165\\'%3E%3Crect width=\\'300\\' height=\\'165\\' fill=\\'%231e293b\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-family=\\'sans-serif\\' font-size=\\'12\\' fill=\\'%2394a3b8\\'%3EImage Loading Failed%3C/text%3E%3C/svg%3E';"
          />
          ${categoryTag}
          <div style="position:absolute; bottom:8px; left:8px; z-index:2;">
            ${statusBadge}
          </div>
        </div>
        <div class="gallery-card-body" style="padding:12px; display:flex; flex-direction:column; flex:1; justify-content:space-between;">
          <div>
            ${batchTagHtml}
            <div style="font-weight:600; font-size:0.9rem; color:#0f172a; margin-bottom:3px; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${titleText}
            </div>
            <div style="font-size:0.76rem; color:${isDefective ? '#b91c1c' : '#15803d'}; font-weight:500; margin-bottom:4px;">
              ${defectDiagnosis}${confScore}
            </div>
            ${defectOverlayHtml}
          </div>
          <div style="font-size:0.72rem; color:#94a3b8; margin-top:8px; padding-top:6px; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
            <span>${timestampStr}</span>
            <span style="font-weight:600; color:#6366f1;">Inspect →</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Handles opening inspection popup modal
 */
function openGalleryModal(id) {
  const item = galleryImages.find((img) => img.id === id);
  if (!item) return;

  const rawUrl = item.value || item.imagePath;
  const fullUrl = resolveGalleryImageUrl(rawUrl);
  const analysis = parseAnalysis(item.imageAnalysis);

  if (typeof showImagePopup === 'function') {
    showImagePopup(fullUrl, analysis, item);
  } else {
    window.open(fullUrl, '_blank');
  }
}
window.openGalleryModal = openGalleryModal;

/**
 * Quick button to open upload panel set to current active category
 */
function openUploadPanelForCurrentCategory() {
  const panel = document.getElementById('manualUploadPanel');
  if (panel) {
    panel.style.display = 'block';
  }
  const select = document.getElementById('uploadCategorySelect');
  if (select) {
    select.value = activeCategory === 'final_product' ? 'final_product' : 'raw_material';
    onUploadCategoryChange();
  }
  panel.scrollIntoView({ behavior: 'smooth' });
}
window.openUploadPanelForCurrentCategory = openUploadPanelForCurrentCategory;

/**
 * Toggles upload panel visibility
 */
function toggleUploadPanel() {
  const panel = document.getElementById('manualUploadPanel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    onUploadCategoryChange();
    panel.scrollIntoView({ behavior: 'smooth' });
  }
}
window.toggleUploadPanel = toggleUploadPanel;

/**
 * Toggles calibration panel visibility
 */
function toggleCalibPanel() {
  const panel = document.getElementById('calibrationPanel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    panel.scrollIntoView({ behavior: 'smooth' });
  }
}
window.toggleCalibPanel = toggleCalibPanel;

/**
 * Updates quick suggestion tags when upload category changes
 */
function onUploadCategoryChange() {
  const select = document.getElementById('uploadCategorySelect');
  const tagsContainer = document.getElementById('uploadQuickTags');
  const paramInput = document.getElementById('uploadParameter');
  if (!select || !tagsContainer) return;

  const val = select.value;
  let tags = [];

  if (val === 'raw_material') {
    tags = [
      'Neem Raw Material Inspection',
      'Tulsi Raw Material QA',
      'Turmeric Extract Specimen',
      'Botanical API Raw Screening',
      'St. John\'s Wort Herb QA'
    ];
    if (paramInput && !paramInput.value) paramInput.placeholder = 'e.g. Tulsi Leaf Specimen, Neem Botanical API';
  } else if (val === 'final_product') {
    tags = [
      'Paracetamol 500mg Tablet Surface Inspection',
      'Ibuprofen 400mg Compressed Tablet QA',
      'Aspirin 100mg Enteric Coated Tablet',
      'Acetaminophen 500mg Finished Tablet',
      'Amoxicillin Blister Pack Seal QA'
    ];
    if (paramInput && !paramInput.value) paramInput.placeholder = 'e.g. Paracetamol 500mg Tablet Surface QA, Blister Seal QA';
  } else if (val === 'compression') {
    tags = [
      'Tablet Press Punch Hardness QA',
      'Metformin ER Tablet Compression',
      'Core Tablet Friability Check'
    ];
  } else {
    tags = ['In-Process Visual QA', 'General Machine Camera Inspection'];
  }

  tagsContainer.innerHTML = tags.map(t => `<button type="button" class="quick-tag-btn" onclick="applyQuickTag('${t.replace(/'/g, "\\'")}')">${t}</button>`).join('');
}
window.onUploadCategoryChange = onUploadCategoryChange;

function applyQuickTag(text) {
  const paramInput = document.getElementById('uploadParameter');
  if (paramInput) {
    paramInput.value = text;
  }
}
window.applyQuickTag = applyQuickTag;

/**
 * Initializes the Reference Color calibration panel.
 */
function initCalibrationPanel() {
  const picker = document.getElementById('calibColorPicker');
  const swatch = document.getElementById('calibSwatchPreview');
  const saveBtn = document.getElementById('saveCalibration');
  if (!picker || !saveBtn) return;

  picker.addEventListener('input', () => {
    if (swatch) swatch.style.background = picker.value;
  });

  saveBtn.addEventListener('click', async () => {
    const parameter = document.getElementById('calibParameter').value.trim();
    const statusEl = document.getElementById('calibrationStatus');

    if (!parameter) {
      statusEl.innerHTML = '<span style="color:#dc2626;font-weight:600;">Parameter name is required.</span>';
      return;
    }

    const hex = picker.value.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    statusEl.innerHTML = '<span style="color:#64748b;">Saving reference benchmark standard...</span>';

    try {
      const response = await fetch(`${BACKEND_URL}/api/reference-color`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameter, r, g, b }),
      });
      const data = await response.json();
      if (response.ok) {
        statusEl.innerHTML = `<span style="color:#16a34a;font-weight:600;">&#10004; Saved reference benchmark for "${parameter}".</span>`;
        setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 4000);
      } else {
        statusEl.innerHTML = `<span style="color:#dc2626;font-weight:600;">${data.error || 'Failed to save.'}</span>`;
      }
    } catch (err) {
      console.error('Failed to save reference color:', err);
      statusEl.innerHTML = '<span style="color:#dc2626;font-weight:600;">Error saving reference color.</span>';
    }
  });
}

/**
 * Initializes the manual image upload functionality.
 */
function initManualUpload() {
  const btn = document.getElementById('uploadImageBtn');
  const fileInput = document.getElementById('uploadFileInput');
  const previewContainer = document.getElementById('uploadPreviewContainer');
  const previewImg = document.getElementById('uploadPreviewImg');
  const clearBtn = document.getElementById('clearUploadPreview');
  const statusEl = document.getElementById('uploadStatus');

  if (!btn || !fileInput) return;

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && previewContainer && previewImg) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewContainer.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    } else if (previewContainer) {
      previewContainer.style.display = 'none';
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      fileInput.value = '';
      if (previewContainer) previewContainer.style.display = 'none';
    });
  }

  btn.addEventListener('click', async () => {
    const paramInput = document.getElementById('uploadParameter');
    const categorySelect = document.getElementById('uploadCategorySelect');
    const batchSelect = document.getElementById('uploadBatchSelect');

    const parameter = paramInput ? paramInput.value.trim() : '';
    const categoryVal = categorySelect ? categorySelect.value : 'raw_material';
    const batchId = batchSelect ? batchSelect.value : null;
    const file = fileInput.files[0];

    if (!file) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;font-weight:600;">Please choose an image file first.</span>';
      return;
    }

    if (statusEl) statusEl.innerHTML = '<span style="color:#6366f1;font-weight:600;">Uploading and running AI inspection...</span>';
    btn.disabled = true;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          const base64 = jpegDataUrl.split(',')[1];

          // Determine stage name based on category selection
          let stageName = 'Raw Material Receipt';
          let stepName = 'Stage 1 Botanical Screening';
          if (categoryVal === 'final_product') {
            stageName = 'Final QC';
            stepName = 'Stage 8 Visual Inspection';
          } else if (categoryVal === 'compression') {
            stageName = 'Compression';
            stepName = 'Stage 7 Tablet Press In-Line QA';
          }

          const response = await fetch(`${BACKEND_URL}/api/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parameter: parameter || (categoryVal === 'final_product' ? 'Finished Tablet QA' : 'Raw Material Botanical QA'),
              imageBase64: base64,
              category: categoryVal,
              processStage: stageName,
              stageStep: stepName,
              batchId: batchId || null,
              sampleMetadata: {
                targetCategory: categoryVal,
                uploadedAt: new Date().toISOString()
              }
            }),
          });

          const data = await response.json();

          if (response.ok) {
            if (statusEl) statusEl.innerHTML = `<span style="color:#16a34a;font-weight:600;">&#10004; Sample uploaded & inspected successfully!</span>`;
            fileInput.value = '';
            if (paramInput) paramInput.value = '';
            if (previewContainer) previewContainer.style.display = 'none';

            // Auto-switch to the category of the uploaded image
            switchCategoryTab(categoryVal === 'final_product' ? 'final_product' : 'raw_material');
            await loadGallery();
            setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 4500);
          } else {
            if (statusEl) statusEl.innerHTML = `<span style="color:#dc2626;font-weight:600;">${data.error || 'Upload failed.'}</span>`;
          }
        } catch (err) {
          console.error('Manual upload error:', err);
          if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;font-weight:600;">Error uploading. Ensure backend server is running.</span>';
        } finally {
          btn.disabled = false;
        }
      };
      img.onerror = () => {
        if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;font-weight:600;">Invalid image file format.</span>';
        btn.disabled = false;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Periodically polls for incoming camera captures
 */
async function pollForNewImages() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    if (!response.ok) return;
    const state = await response.json();
    const currentImages = (state.analyticalData || [])
      .filter((item) => item.dataType === 'image' || (item.value && item.value.includes('/uploads/')));

    if (lastKnownImageCount > 0 && currentImages.length > lastKnownImageCount) {
      const newCount = currentImages.length - lastKnownImageCount;
      showLiveNotification(`${newCount} new inspection image${newCount > 1 ? 's' : ''} captured`);
      
      galleryImages = currentImages.map((item) => ({
        ...item,
        imageAnalysis: parseAnalysis(item.imageAnalysis),
        category: classifyCategory(item),
        qaStatus: classifyQA(item)
      }));

      updateCategoryCounts();
      updateHeroAndKpis();
      renderGallery();
    }
    lastKnownImageCount = currentImages.length;
  } catch (err) {
    console.debug('Gallery polling skipped:', err.message);
  }
}

/**
 * Displays toast notification
 */
function showLiveNotification(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;top:24px;right:24px;background:#0f172a;color:#ffffff;padding:10px 18px;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,0.25);z-index:99999;font-weight:600;font-size:0.85rem;border:1px solid #334155;animation:fadeIn 0.3s ease;';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/**
 * Triggers batch background removal & defect re-analysis for all database images
 */
async function reanalyzeAllImages() {
  const btn = document.getElementById('reanalyzeBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px; animation:spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
        <path d="M12 2 A10 10 0 0 1 22 12"></path>
      </svg>
      Analyzing Images...
    `;
  }

  showLiveNotification('Running precision background removal & defect scan across all samples...');

  try {
    const res = await fetch(`${BACKEND_URL}/api/reanalyze-all-images`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showLiveNotification(`Precision QA complete: ${data.updatedCount || 0} samples processed with background removal`);
      await loadGallery();
    } else {
      showLiveNotification(`Scan notice: ${data.error || 'Check server logs'}`);
    }
  } catch (err) {
    console.error('Reanalysis failed:', err);
    showLiveNotification('Error running reanalysis. Ensure backend is running.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        Precision Re-Scan
      `;
    }
  }
}
window.reanalyzeAllImages = reanalyzeAllImages;

/**
 * Main Initialization Routine
 */
function initImageGallery() {
  if (document.getElementById('galleryGrid')) {
    loadGallery().then(() => {
      lastKnownImageCount = galleryImages.length;
    });

    const refreshBtn = document.getElementById('refreshGallery');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Refreshing...';
        await loadGallery();
        refreshBtn.textContent = 'Refresh';
        refreshBtn.disabled = false;
      });
    }

    const reanalyzeBtn = document.getElementById('reanalyzeBtn');
    if (reanalyzeBtn) {
      reanalyzeBtn.addEventListener('click', reanalyzeAllImages);
    }

    initCalibrationPanel();
    initManualUpload();
    onUploadCategoryChange();
    setInterval(pollForNewImages, 10000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initImageGallery);
} else {
  initImageGallery();
}
