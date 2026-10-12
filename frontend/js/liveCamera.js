var BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL) ? window.BACKEND_URL : 'http://localhost:3000';

function resolveImageUrl(url) {
  if (!url) {
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect width="300" height="200" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2394a3b8"%3ENo Image Available%3C/text%3E%3C/svg%3E';
  }
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${BACKEND_URL}${cleanPath}`;
}

let cameraRefreshInterval = null;

async function loadLatestImages() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/state`);
    const state = await response.json();

    const imageReadings = (state.analyticalData || []).filter((item) => item.dataType === 'image' || (item.value && item.value.includes('/uploads/')));
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
    if (!grid) return;
    const entries = Object.values(latestByPoint);

    if (entries.length === 0) {
      grid.innerHTML = `<p style="color:#94a3b8;grid-column:1/-1;text-align:center;padding:2rem;">No camera images received yet.</p>`;
    } else {
      grid.innerHTML = entries.map((img) => {
        const mpName = monitoringPoints.find((mp) => mp.id === img.monitoringPointId)?.name || 'Unassigned';
        const imageUrl = resolveImageUrl(img.value || img.imagePath);
        const secondsAgo = Math.max(0, Math.round((Date.now() - new Date(img.receivedAt).getTime()) / 1000));
        
        return `
          <div class="camera-card" style="position:relative; border-radius:12px; overflow:hidden; background:#0f172a; border:1px solid #334155; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); display:flex; flex-direction:column; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 20px 25px -5px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 10px 15px -3px rgba(0,0,0,0.1)';">
            <div style="position:relative; width:100%; height:240px; overflow:hidden; background:#000; cursor:pointer;" onclick="openLiveView('${img.monitoringPointId}', '${mpName}')">
              
              <img 
                src="${imageUrl}" 
                alt="${mpName}" 
                style="width:100%;height:100%;object-fit:cover; opacity:0.85; filter: contrast(1.1) brightness(1.1) grayscale(0.2);" 
                onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'240\\' viewBox=\\'0 0 300 240\\'%3E%3Crect width=\\'300\\' height=\\'240\\' fill=\\'%23000\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-family=\\'monospace\\' font-size=\\'14\\' fill=\\'%23ef4444\\'%3ESIGNAL LOST%3C/text%3E%3C/svg%3E';"
              />
          
              <div style="position:absolute; top:12px; left:12px; display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.7); padding:4px 10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="width:8px; height:8px; background:#ef4444; border-radius:50%; animation: cameraBlink 1.5s infinite;"></div>
                <span style="color:#ef4444; font-size:0.75rem; font-weight:700; letter-spacing:1px; font-family:monospace;">LIVE</span>
              </div>
          
              <div style="position:absolute; top:12px; right:12px; background:rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.5); padding:4px 10px; border-radius:6px; color:#10b981; font-size:0.7rem; font-weight:600; font-family:monospace; display:flex; align-items:center; gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 12 2.1 12"/></svg>
                AI ACTIVE
              </div>
          
              <div style="position:absolute; bottom:12px; left:12px; background:rgba(0,0,0,0.7); padding:4px 10px; border-radius:6px; color:#f8fafc; font-size:0.75rem; font-family:monospace; border: 1px solid rgba(255,255,255,0.1);">
                CAM-${(img.monitoringPointId || '001').substring(0,4).toUpperCase()} | ${mpName.toUpperCase()}
              </div>
          
              <div style="position:absolute; bottom:12px; right:12px; background:rgba(0,0,0,0.7); padding:4px 10px; border-radius:6px; color:#94a3b8; font-size:0.75rem; font-family:monospace; border: 1px solid rgba(255,255,255,0.1);">
                T-${secondsAgo}s
              </div>
          
              <div style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06)); background-size: 100% 4px, 3px 100%; pointer-events:none;"></div>
              <div style="position:absolute; top:0; left:0; width:100%; height:2px; background:rgba(16,185,129,0.5); box-shadow:0 0 10px rgba(16,185,129,1); animation: cameraScanline 3s linear infinite; pointer-events:none;"></div>
            </div>
            
            <div style="padding:16px; display:flex; justify-content:space-between; align-items:center; background:#1e293b; border-top:1px solid #334155;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <strong style="color:#f8fafc; font-size:0.95rem;">${mpName}</strong>
                <div style="display:flex; align-items:center; gap:6px;">
                  <div style="width:6px; height:6px; border-radius:50%; background:#10b981;"></div>
                  <span style="color:#94a3b8; font-size:0.8rem;">Status: Optimal</span>
                </div>
              </div>
              <button class="button button--primary" style="padding:8px 20px; font-size:0.85rem; border-radius:6px; background:#3b82f6; color:white; border:none; cursor:pointer;" onclick="openLiveView('${img.monitoringPointId}', '${mpName}')">Expand</button>
            </div>
          </div>
        `;
      }).join('');
    }

    const lastUpdatedEl = document.getElementById('cameraLastUpdated');
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = `Last checked: ${new Date().toLocaleTimeString()}`;
    }
  } catch (err) {
    console.error('Failed to load camera images:', err);
  }
}

function initLiveCameraPage() {
  // Inject CCTV animations
  if (!document.getElementById('cameraAnimations')) {
    const style = document.createElement('style');
    style.id = 'cameraAnimations';
    style.innerHTML = `
      @keyframes cameraBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      @keyframes cameraScanline { 0% { top: 0; } 100% { top: 100%; } }
      @keyframes pulseBox { 0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 50% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } }
    `;
    document.head.appendChild(style);
  }

  loadLatestImages();

  const filterSelect = document.getElementById('cameraMonitoringPointFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', loadLatestImages);
  }

  if (cameraRefreshInterval) clearInterval(cameraRefreshInterval);
  cameraRefreshInterval = setInterval(loadLatestImages, 5000); // Polling faster to simulate "live" better
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
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);backdrop-filter:blur(10px);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box; font-family:monospace;';
  modal.innerHTML = `
    <div style="position:relative; width:90%; max-width:1000px; background:#000; border:1px solid #334155; border-radius:12px; overflow:hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
      
      <!-- Top Bar -->
      <div style="position:absolute; top:0; left:0; right:0; padding:16px; display:flex; justify-content:space-between; align-items:center; background:linear-gradient(rgba(0,0,0,0.8), transparent); z-index:10;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:12px; height:12px; background:#ef4444; border-radius:50%; animation: cameraBlink 1.5s infinite;"></div>
          <span style="color:#ef4444; font-size:1.1rem; font-weight:700; letter-spacing:2px;">LIVE MONITORING</span>
        </div>
        <div style="color:white; font-size:1.2rem; font-weight:700; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${mpName.toUpperCase()}</div>
      </div>

      <!-- Image Container -->
      <div style="position:relative; width:100%; height:70vh; display:flex; justify-content:center; align-items:center; overflow:hidden;">
        <img id="liveViewImage" style="width:100%; height:100%; object-fit:contain; filter: contrast(1.1) brightness(1.05);" />
        
        <!-- Mock Bounding Boxes / AI Analysis -->
        <div style="position:absolute; top:20%; left:30%; width:120px; height:80px; border:2px solid #10b981; border-radius:4px; animation: pulseBox 2s infinite;">
          <div style="position:absolute; top:-22px; left:-2px; background:#10b981; color:white; padding:2px 6px; font-size:0.75rem; font-weight:bold; border-radius:4px 4px 0 0;">OBJECT DETECTED: 98%</div>
        </div>

        <div style="position:absolute; top:50%; left:60%; width:90px; height:90px; border:2px solid #3b82f6; border-radius:4px;">
          <div style="position:absolute; top:-22px; left:-2px; background:#3b82f6; color:white; padding:2px 6px; font-size:0.75rem; font-weight:bold; border-radius:4px 4px 0 0;">TRACKING: ACTIVE</div>
        </div>
        
        <!-- Crosshairs -->
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:40px; height:40px; border:1px solid rgba(255,255,255,0.3); border-radius:50%; pointer-events:none;">
          <div style="position:absolute; top:50%; left:-10px; right:-10px; height:1px; background:rgba(255,255,255,0.3);"></div>
          <div style="position:absolute; left:50%; top:-10px; bottom:-10px; width:1px; background:rgba(255,255,255,0.3);"></div>
        </div>

        <!-- Scanline -->
        <div style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 4px; pointer-events:none;"></div>
        <div style="position:absolute; top:0; left:0; width:100%; height:3px; background:rgba(16,185,129,0.3); box-shadow:0 0 15px rgba(16,185,129,0.8); animation: cameraScanline 4s linear infinite; pointer-events:none;"></div>
      </div>

      <!-- Bottom Bar -->
      <div style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; background:#111827; border-top:1px solid #334155;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div id="liveViewStatus" style="color:#10b981; font-size:0.9rem; font-weight:bold;">SYSTEM ONLINE - AI ACTIVE</div>
          <div style="color:#64748b; font-size:0.8rem;">Resolution: 1080p | FPS: 30 | Network: Stable</div>
        </div>
        <button class="button button--secondary" style="padding:10px 24px; font-size:1rem; font-weight:bold; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer;" onclick="closeLiveView()">TERMINATE FEED</button>
      </div>
    </div>
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
      (item) => (item.dataType === 'image' || (item.value && item.value.includes('/uploads/'))) && item.monitoringPointId === liveViewMonitoringPointId
    );
    if (imageReadings.length === 0) return;

    const latest = imageReadings.reduce((max, curr) =>
      new Date(curr.receivedAt) > new Date(max.receivedAt) ? curr : max
    );

    const imgEl = document.getElementById('liveViewImage');
    if (imgEl) {
      imgEl.src = resolveImageUrl(latest.value || latest.imagePath);
    }

    const statusEl = document.getElementById('liveViewStatus');
    if (statusEl) statusEl.textContent = `SYSTEM ONLINE - AI ACTIVE | LAST UPDATE: ${new Date(latest.receivedAt).toLocaleTimeString()}`;
  } catch (err) {
    console.error('Live view refresh failed:', err);
  }
}

function closeLiveView() {
  if (liveViewInterval) clearInterval(liveViewInterval);
  const modal = document.getElementById('liveViewModal');
  if (modal) modal.remove();
}