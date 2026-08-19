let cameraRefreshInterval = null;

async function loadLatestImages() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();

    const imageReadings = (state.analyticalData || []).filter((item) => item.dataType === 'image');
    const monitoringPoints = state.monitoringPoints || [];

    const filterSelect = document.getElementById('cameraMonitoringPointFilter');
    if (filterSelect && filterSelect.options.length === 1) {
      monitoringPoints.forEach((mp) => {
        const opt = document.createElement('option');
        opt.value = mp.id;
        opt.textContent = mp.name;
        filterSelect.appendChild(opt);
      });
    }

    const selectedMp = filterSelect ? filterSelect.value : '';
    const filtered = selectedMp
      ? imageReadings.filter((img) => img.monitoringPointId === selectedMp)
      : imageReadings;

    const latestByPoint = {};
    filtered.forEach((img) => {
      const key = img.monitoringPointId || 'unassigned';
      if (!latestByPoint[key] || new Date(img.receivedAt) > new Date(latestByPoint[key].receivedAt)) {
        latestByPoint[key] = img;
      }
    });

    const grid = document.getElementById('cameraGrid');
    const entries = Object.values(latestByPoint);

    if (entries.length === 0) {
      grid.innerHTML = `<p style="color:#94a3b8;">No camera images received yet.</p>`;
    } else {
      grid.innerHTML = entries.map((img) => {
        const mpName = monitoringPoints.find((mp) => mp.id === img.monitoringPointId)?.name || 'Unassigned';
        const imageUrl = img.value || img.imagePath;
        const secondsAgo = Math.round((Date.now() - new Date(img.receivedAt).getTime()) / 1000);
       return `
          <div class="card" style="padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong>${mpName}</strong>
              <span style="color:#64748b;font-size:0.8rem;">${secondsAgo}s ago</span>
            </div>
            <img src="${imageUrl}" style="width:100%;border-radius:8px;display:block;cursor:pointer;" onclick="openLiveView('${img.monitoringPointId}', '${mpName}')" />
            <button class="button button--secondary" style="margin-top:8px;width:100%;" onclick="openLiveView('${img.monitoringPointId}', '${mpName}')">View Live</button>
          </div>
        `;
      }).join('');
    }

    document.getElementById('cameraLastUpdated').textContent = `Last checked: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('Failed to load camera images:', err);
  }
}

function initLiveCameraPage() {
  loadLatestImages();

  const filterSelect = document.getElementById('cameraMonitoringPointFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', loadLatestImages);
  }

  if (cameraRefreshInterval) clearInterval(cameraRefreshInterval);
  cameraRefreshInterval = setInterval(loadLatestImages, 8000);
}

if (document.getElementById('cameraGrid')) {
  initLiveCameraPage();
}
let liveViewInterval = null;
let liveViewMonitoringPointId = null;

function openLiveView(monitoringPointId, mpName) {
  liveViewMonitoringPointId = monitoringPointId;

  const modal = document.createElement('div');
  modal.id = 'liveViewModal';
  modal.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="color:white;margin-bottom:12px;font-size:1.2rem;">${mpName} - Live View</div>
    <img id="liveViewImage" style="max-width:90%;max-height:75vh;border-radius:8px;" />
    <div id="liveViewStatus" style="color:#94a3b8;margin-top:12px;"></div>
    <button class="button button--secondary" style="margin-top:16px;" onclick="closeLiveView()">Close</button>
  `;
  document.body.appendChild(modal);

  refreshLiveViewImage();
  liveViewInterval = setInterval(refreshLiveViewImage, 3000);
}

async function refreshLiveViewImage() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();
    const imageReadings = (state.analyticalData || []).filter(
      (item) => item.dataType === 'image' && item.monitoringPointId === liveViewMonitoringPointId
    );
    if (imageReadings.length === 0) return;

    const latest = imageReadings.reduce((max, curr) =>
      new Date(curr.receivedAt) > new Date(max.receivedAt) ? curr : max
    );

    const imgEl = document.getElementById('liveViewImage');
    if (imgEl) imgEl.src = latest.value || latest.imagePath;

    const statusEl = document.getElementById('liveViewStatus');
    if (statusEl) statusEl.textContent = `Updated: ${new Date(latest.receivedAt).toLocaleTimeString()}`;
  } catch (err) {
    console.error('Live view refresh failed:', err);
  }
}

function closeLiveView() {
  if (liveViewInterval) clearInterval(liveViewInterval);
  const modal = document.getElementById('liveViewModal');
  if (modal) modal.remove();
}