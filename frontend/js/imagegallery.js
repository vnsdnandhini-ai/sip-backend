// Spectroscopic Intelligence Platform - Image Gallery Controller
var BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : 'http://localhost:3000';
window.BACKEND_URL = BACKEND_URL;

var galleryFilter = 'all';
var galleryImages = [];
var lastKnownImageCount = 0;

/**
 * Resolves an image path to an absolute accessible URL.
 * Handles relative `/uploads/...` paths across different host ports.
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
 * Classifies an image into clean (Healthy), contaminated (Defective), or capture issue.
 */
function classifyImage(item) {
  const analysis = parseAnalysis(item.imageAnalysis);
  if (!analysis) return 'clean';

  const ai = analysis.ai;
  if (ai && ai.condition) {
    const cond = String(ai.condition).toLowerCase();
    if (cond.includes('defective') || ai.visual_qa_result === 'CRITICAL' || cond.includes('disease') || cond.includes('lesion')) return 'contaminated';
    if (cond.includes('healthy') || ai.visual_qa_result === 'PASS') return 'clean';
  }

  if (analysis.condition) {
    const cond = String(analysis.condition).toLowerCase();
    if (cond.includes('defective') || cond.includes('lesion') || cond.includes('contamination') || cond.includes('necrosis')) return 'contaminated';
    if (cond.includes('healthy')) return 'clean';
  }

  if (analysis.isDefective === true || analysis.isDefectiveSample === true) return 'contaminated';
  if (analysis.isDefective === false || analysis.isDefectiveSample === false) return 'clean';

  if (analysis.defectPercent !== undefined) {
    return analysis.defectPercent > 4.0 ? 'contaminated' : 'clean';
  }

  if (analysis.isContaminated || analysis.visualQaResult === 'CRITICAL') {
    return 'contaminated';
  }

  if (analysis.captureQualityOk === false) return 'issue';
  return 'clean';
}

/**
 * Loads images from backend state and triggers render.
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
    
    galleryImages = (state.analyticalData || [])
      .filter((item) => item.dataType === 'image' || (item.value && (item.value.includes('/uploads/') || item.value.startsWith('data:image'))))
      .map((item) => ({
        ...item,
        imageAnalysis: parseAnalysis(item.imageAnalysis),
      }))
      .sort((a, b) => {
        const timeA = new Date(a.receivedAt || a.deviceTimestamp || 0).getTime();
        const timeB = new Date(b.receivedAt || b.deviceTimestamp || 0).getTime();
        return timeB - timeA;
      });

    updateFilterCounts();
    renderGallery();
  } catch (err) {
    console.error('Failed to load gallery:', err);
    grid.innerHTML = `
      <div class="gallery-empty" style="grid-column:1/-1; padding:3rem 1rem; text-align:center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:12px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div style="font-weight:600; color:#334155; margin-bottom:4px;">Unable to Connect to API</div>
        <div style="font-size:0.85rem; color:#64748b;">Ensure the backend server is running on port 3000.</div>
      </div>`;
  }
}
window.loadGallery = loadGallery;

/**
 * Updates dynamic counter badges on the filter buttons.
 */
function updateFilterCounts() {
  let cleanCount = 0;
  let contaminatedCount = 0;
  let issueCount = 0;

  galleryImages.forEach((img) => {
    const status = classifyImage(img);
    if (status === 'clean') cleanCount++;
    else if (status === 'contaminated') contaminatedCount++;
    else if (status === 'issue') issueCount++;
  });

  const elAll = document.getElementById('countAll');
  const elClean = document.getElementById('countClean');
  const elContaminated = document.getElementById('countContaminated');
  const elIssue = document.getElementById('countIssue');
  const elSummary = document.getElementById('galleryStatsSummary');

  if (elAll) elAll.textContent = `(${galleryImages.length})`;
  if (elClean) elClean.textContent = `(${cleanCount})`;
  if (elContaminated) elContaminated.textContent = `(${contaminatedCount})`;
  if (elIssue) elIssue.textContent = `(${issueCount})`;

  if (elSummary) {
    elSummary.textContent = `${galleryImages.length} raw material image(s) verified`;
  }
}

/**
 * Sets the active category filter.
 */
function setGalleryFilter(filter) {
  galleryFilter = filter;
  document.querySelectorAll('.gallery-filters .filter-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderGallery();
}
window.setGalleryFilter = setGalleryFilter;

/**
 * Renders the gallery grid based on active filter.
 */
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  const filtered = galleryFilter === 'all'
    ? galleryImages
    : galleryImages.filter((item) => classifyImage(item) === galleryFilter);

  if (filtered.length === 0) {
    const filterLabel = galleryFilter === 'all' ? 'No raw material images captured yet' : `No ${galleryFilter} raw material samples found`;
    grid.innerHTML = `
      <div class="gallery-empty" style="grid-column:1/-1; padding:3rem 1rem; text-align:center;">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom:12px;">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <div style="font-weight:600; color:#334155; margin-bottom:4px;">${filterLabel}</div>
        <div style="font-size:0.85rem; color:#64748b;">Upload a raw material photo above to inspect whether it is Healthy or Defective.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((item) => {
    const rawUrl = item.value || item.imagePath;
    const imageUrl = resolveGalleryImageUrl(rawUrl);
    const classification = classifyImage(item);
    const analysis = parseAnalysis(item.imageAnalysis);
    const ai = analysis && analysis.ai;

    const isHealthy = classification === 'clean';
    const isDefective = classification === 'contaminated';

    let statusBadge = '<span class="badge" style="background:#dcfce7;color:#15803d;font-weight:700;border:1px solid #86efac;padding:3px 8px;border-radius:6px;font-size:0.75rem;">🟢 HEALTHY</span>';
    if (isDefective) {
      statusBadge = '<span class="badge" style="background:#fee2e2;color:#b91c1c;font-weight:700;border:1px solid #fca5a5;padding:3px 8px;border-radius:6px;font-size:0.75rem;">🔴 DEFECTIVE</span>';
    } else if (classification === 'issue') {
      statusBadge = '<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;border:1px solid #fde68a;padding:3px 8px;border-radius:6px;font-size:0.75rem;">⚠️ REVIEW</span>';
    }

    const isGenericParam = !item.parameter || ['Manual Upload', 'Image', 'test', 'tes', 'one', 'two', 'plant', 'leaf'].includes(item.parameter.trim());
    const materialName = (!isGenericParam) 
      ? item.parameter 
      : (isDefective ? 'Botanical Leaf / Defective Specimen' : 'Approved Botanical Raw Material');
    const defectNote = isDefective 
      ? ((ai && ai.detected_defect && ai.detected_defect !== 'None') ? ai.detected_defect : ((analysis && analysis.detectedDefect && analysis.detectedDefect !== 'None') ? analysis.detectedDefect : 'Surface Lesions / Discoloration Detected'))
      : 'Approved Botanical Standard';

    let defectOverlayHtml = '';
    if (isDefective && ai && ai.pixel_anomaly_map) {
      const defectMapUrl = resolveGalleryImageUrl(ai.pixel_anomaly_map);
      defectOverlayHtml = `
        <div style="position:relative; margin-top:8px;">
          <img src="${defectMapUrl}" style="width:100%;height:44px;object-fit:cover;border-radius:6px;border:1px solid #fca5a5;opacity:0.95;" loading="lazy" onerror="this.parentElement.style.display='none'" />
          <span style="position:absolute;top:2px;left:4px;font-size:0.62rem;color:#dc2626;font-weight:bold;background:rgba(255,255,255,0.9);padding:1px 5px;border-radius:4px;">⚠ Defect Localization</span>
        </div>`;
    }

    const confScore = (ai && ai.confidence_score !== undefined) ? ` · ${ai.confidence_score}% Conf.` : '';
    const timestampStr = item.receivedAt ? new Date(item.receivedAt).toLocaleString() : 'Recent';

    return `
      <div class="gallery-card" onclick="openGalleryModal('${item.id}')" title="Click to view detailed inspection report" style="border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.06);transition:transform 0.2s, box-shadow 0.2s;">
        <div style="position:relative; width:100%; height:165px; background:#0f172a; overflow:hidden;">
          <img 
            src="${imageUrl}" 
            alt="${materialName}" 
            loading="lazy" 
            style="width:100%; height:100%; object-fit:cover; display:block;"
            onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'160\\' viewBox=\\'0 0 300 160\\'%3E%3Crect width=\\'300\\' height=\\'160\\' fill=\\'%231e293b\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-family=\\'sans-serif\\' font-size=\\'12\\' fill=\\'%2394a3b8\\'%3EImage Loading Failed%3C/text%3E%3C/svg%3E';"
          />
          <div style="position:absolute; top:8px; left:8px;">
            ${statusBadge}
          </div>
        </div>
        <div class="gallery-card-body" style="padding:14px;">
          <div style="font-weight:700; font-size:0.92rem; color:#0f172a; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${materialName}
          </div>
          <div style="font-size:0.78rem; color:${isDefective ? '#b91c1c' : '#475569'}; margin-bottom:6px;">
            ${defectNote}${confScore}
          </div>
          ${defectOverlayHtml}
          <div style="font-size:0.72rem; color:#94a3b8; margin-top:8px;">
            ${timestampStr}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Handles modal open securely by looking up item in state.
 */
function openGalleryModal(id) {
  const item = galleryImages.find((img) => img.id === id);
  if (!item) return;

  const rawUrl = item.value || item.imagePath;
  const fullUrl = resolveGalleryImageUrl(rawUrl);
  const analysis = parseAnalysis(item.imageAnalysis);

  if (typeof showImagePopup === 'function') {
    showImagePopup(fullUrl, analysis);
  } else {
    window.open(fullUrl, '_blank');
  }
}
window.openGalleryModal = openGalleryModal;

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

    statusEl.innerHTML = '<span style="color:#64748b;">Saving reference color...</span>';

    try {
      const response = await fetch(`${BACKEND_URL}/api/reference-color`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameter, r, g, b }),
      });
      const data = await response.json();
      if (response.ok) {
        statusEl.innerHTML = `<span style="color:#16a34a;font-weight:600;">&#10004; Saved reference color for "${parameter}".</span>`;
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
window.initCalibrationPanel = initCalibrationPanel;

/**
 * Periodically polls for new incoming camera captures and updates gallery.
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
      showLiveNotification(`${newCount} new image${newCount > 1 ? 's' : ''} captured`);
    }
    lastKnownImageCount = currentImages.length;

    galleryImages = currentImages
      .map((item) => ({
        ...item,
        imageAnalysis: parseAnalysis(item.imageAnalysis),
      }))
      .sort((a, b) => {
        const timeA = new Date(a.receivedAt || a.deviceTimestamp || 0).getTime();
        const timeB = new Date(b.receivedAt || b.deviceTimestamp || 0).getTime();
        return timeB - timeA;
      });

    updateFilterCounts();
    renderGallery();
  } catch (err) {
    console.debug('Gallery polling skipped:', err.message);
  }
}

/**
 * Displays a non-intrusive toast notification.
 */
function showLiveNotification(message) {
  const toast = document.createElement('div');
  toast.innerHTML = `<span style="margin-right:6px;">&#128247;</span> ${message}`;
  toast.style.cssText = 'position:fixed;top:24px;right:24px;background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.25);z-index:99999;font-weight:600;font-size:0.88rem;border:1px solid #334155;display:flex;align-items:center;animation:modalFadeIn 0.3s ease;';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
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
    const parameter = paramInput ? paramInput.value.trim() : '';
    const file = fileInput.files[0];

    if (!file) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;font-weight:600;">Please choose an image file first.</span>';
      return;
    }

    if (statusEl) statusEl.innerHTML = '<span style="color:#6366f1;font-weight:600;"><span class="spinner-inline">&#x231b;</span> Uploading and analyzing...</span>';
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

          const response = await fetch(`${BACKEND_URL}/api/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parameter: parameter || 'Manual Upload', imageBase64: base64 }),
          });

          const data = await response.json();

          if (response.ok) {
            if (statusEl) statusEl.innerHTML = `<span style="color:#16a34a;font-weight:600;">&#10004; Uploaded & analyzed successfully!</span>`;
            fileInput.value = '';
            if (paramInput) paramInput.value = '';
            if (previewContainer) previewContainer.style.display = 'none';
            await loadGallery();
            setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 4000);
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
window.initManualUpload = initManualUpload;

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
        refreshBtn.textContent = '\u21BB Refresh';
        refreshBtn.disabled = false;
      });
    }

    initCalibrationPanel();
    initManualUpload();
    setInterval(pollForNewImages, 8000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initImageGallery);
} else {
  initImageGallery();
}
