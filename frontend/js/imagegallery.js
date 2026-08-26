let galleryFilter = 'all';
let galleryImages = [];

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  grid.innerHTML = `<div class="gallery-empty">Loading...</div>`;

  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    galleryImages = (state.analyticalData || [])
      .filter((item) => item.dataType === 'image')
      .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    renderGallery();
  } catch (err) {
    console.error('Failed to load gallery:', err);
    grid.innerHTML = `<div class="gallery-empty">Failed to load images.</div>`;
  }
}

function classifyImage(item) {
  const analysis = item.imageAnalysis;
  if (!analysis) return 'unknown';
  
  // Combine traditional heuristics and AI
  let isBad = analysis.isContaminated;
  let isIssue = analysis.captureQualityOk === false;
  
  if (analysis.ai) {
     if (analysis.ai.visual_qa_result === 'CRITICAL') isBad = true;
     if (analysis.ai.visual_qa_result === 'WARNING' || analysis.ai.visual_qa_result === 'REVIEW REQUIRED') isIssue = true;
  }
  
  if (isBad) return 'contaminated';
  if (isIssue) return 'issue';
  return 'clean';
}

function setGalleryFilter(filter) {
  galleryFilter = filter;
  document.querySelectorAll('.gallery-filters .filter-button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderGallery();
}

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  const filtered = galleryFilter === 'all'
    ? galleryImages
    : galleryImages.filter((item) => classifyImage(item) === galleryFilter);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="gallery-empty">No images match this filter.</div>`;
    return;
  }

  grid.innerHTML = filtered.map((item) => {
    const imageUrl = item.value || item.imagePath;
    const classification = classifyImage(item);
    const analysis = item.imageAnalysis;

    let badgeHtml = '<span class="badge badge--pending">Not Analyzed</span>';
    if (classification === 'clean') badgeHtml = '<span class="badge badge--pass">Clean</span>';
    if (classification === 'contaminated') badgeHtml = '<span class="badge badge--critical">Contaminated</span>';
    if (classification === 'issue') badgeHtml = '<span class="badge badge--warning">Capture Issue</span>';

    const contaminationText = analysis && analysis.contaminationPercent !== undefined
      ? `${analysis.contaminationPercent}% contamination`
      : 'No analysis data';

    const analysisJson = analysis ? JSON.stringify(analysis).replace(/"/g, '&quot;') : 'null';

    return `
      <div class="gallery-card" onclick='showImagePopup("${imageUrl}", ${analysisJson})'>
        <img src="${imageUrl}" loading="lazy" />
        <div class="gallery-card-body">
          <div class="gallery-card-badge">${badgeHtml}</div>
          <div class="gallery-card-meta">${contaminationText}</div>
          <div class="gallery-card-meta">${new Date(item.receivedAt).toLocaleString()}</div>
        </div>
      </div>
    `;
  }).join('');
}

if (document.getElementById('refreshGallery')) {
  document.getElementById('refreshGallery').addEventListener('click', loadGallery);
}


function initCalibrationPanel() {
  const picker = document.getElementById('calibColorPicker');
  const swatch = document.getElementById('calibSwatchPreview');
  const saveBtn = document.getElementById('saveCalibration');
  if (!picker || !saveBtn) return;

  picker.addEventListener('input', () => {
    swatch.style.background = picker.value;
  });

  saveBtn.addEventListener('click', async () => {
    const parameter = document.getElementById('calibParameter').value.trim();
    const statusEl = document.getElementById('calibrationStatus');

    if (!parameter) {
      statusEl.innerHTML = '<span style="color:#dc2626;">Parameter name is required.</span>';
      return;
    }

    const hex = picker.value.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    statusEl.innerHTML = 'Saving...';

    try {
      const response = await fetch(`${BACKEND_URL}/api/reference-color`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameter, r, g, b }),
      });
      const data = await response.json();
      if (response.ok) {
        statusEl.innerHTML = `<span style="color:#16a34a;">Saved reference color for "${parameter}".</span>`;
      } else {
        statusEl.innerHTML = `<span style="color:#dc2626;">${data.error || 'Failed to save.'}</span>`;
      }
    } catch (err) {
      console.error('Failed to save reference color:', err);
      statusEl.innerHTML = '<span style="color:#dc2626;">Error saving. Check console.</span>';
    }
  });
}

let lastKnownImageCount = 0;

async function pollForNewImages() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    const currentImages = (state.analyticalData || []).filter((item) => item.dataType === 'image');

    if (lastKnownImageCount > 0 && currentImages.length > lastKnownImageCount) {
      showLiveNotification(`${currentImages.length - lastKnownImageCount} new image(s) captured`);
    }
    lastKnownImageCount = currentImages.length;

    galleryImages = currentImages.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    renderGallery();
  } catch (err) {
    console.error('Auto-refresh failed:', err);
  }
}

function showLiveNotification(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#16a34a;color:white;padding:12px 20px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:9999;font-weight:600;font-size:0.9rem;';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function initManualUpload() {
  const btn = document.getElementById('uploadImageBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const fileInput = document.getElementById('uploadFileInput');
    const parameter = document.getElementById('uploadParameter').value.trim();
    const statusEl = document.getElementById('uploadStatus');
    const file = fileInput.files[0];

    if (!file) {
      statusEl.innerHTML = '<span style="color:#dc2626;">Please choose an image file first.</span>';
      return;
    }

    statusEl.innerHTML = 'Uploading and analyzing...';

      const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const base64 = jpegDataUrl.split(',')[1];

        try {
          const response = await fetch(`${BACKEND_URL}/api/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parameter: parameter || null, imageBase64: base64 }),
          });
          const data = await response.json();

          if (response.ok) {
            statusEl.innerHTML = `<span style="color:#16a34a;">Uploaded successfully.</span>`;
            fileInput.value = '';
            document.getElementById('uploadParameter').value = '';
            await loadGallery();
          } else {
            statusEl.innerHTML = `<span style="color:#dc2626;">${data.error || 'Upload failed.'}</span>`;
          }
        } catch (err) {
          console.error('Manual upload failed:', err);
          statusEl.innerHTML = '<span style="color:#dc2626;">Error uploading. Check console.</span>';
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('galleryGrid')) {
    loadGallery().then(() => {
      lastKnownImageCount = galleryImages.length;
    });
    initCalibrationPanel();
    initManualUpload();
    setInterval(pollForNewImages, 8000);
  }
});