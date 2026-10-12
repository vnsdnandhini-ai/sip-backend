/**
 * conveyor-alerts.js
 * Real-time audio + visual alert system for ESP32-CAM conveyor belt defect detection.
 * Listens to the SSE stream and fires alerts whenever a defect is detected.
 * Include this script on any page to get global alert coverage.
 */

(function () {
  'use strict';

  const API_BASE = window.location.origin;

  // ===== STYLES =====
  const style = document.createElement('style');
  style.textContent = `
    #conveyor-alert-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 380px;
      pointer-events: none;
    }
    .conveyor-alert-toast {
      pointer-events: all;
      background: #0f172a;
      border-radius: 14px;
      padding: 16px 18px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1.5px rgba(255,255,255,0.07);
      display: flex;
      align-items: flex-start;
      gap: 14px;
      animation: conveyorAlertIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      backdrop-filter: blur(12px);
      border-left: 4px solid #ef4444;
      transition: opacity 0.4s, transform 0.4s;
    }
    .conveyor-alert-toast.warning {
      border-left-color: #f97316;
    }
    .conveyor-alert-toast.critical {
      border-left-color: #ef4444;
      box-shadow: 0 8px 32px rgba(239,68,68,0.25), 0 0 0 1.5px rgba(239,68,68,0.2);
    }
    .conveyor-alert-toast.exiting {
      opacity: 0;
      transform: translateX(40px);
    }
    @keyframes conveyorAlertIn {
      from { opacity: 0; transform: translateX(40px) scale(0.9); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }
    .conveyor-alert-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .conveyor-alert-icon.critical { background: rgba(239,68,68,0.15); }
    .conveyor-alert-icon.warning  { background: rgba(249,115,22,0.15); }
    .conveyor-alert-body { flex: 1; min-width: 0; }
    .conveyor-alert-title {
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .conveyor-alert-title.critical { color: #ef4444; }
    .conveyor-alert-title.warning  { color: #f97316; }
    .conveyor-alert-defect {
      font-size: 0.92rem;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .conveyor-alert-meta {
      font-size: 0.78rem;
      color: #64748b;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .conveyor-alert-meta span { display: flex; align-items: center; gap: 3px; }
    .conveyor-alert-close {
      flex-shrink: 0;
      background: none;
      border: none;
      color: #475569;
      cursor: pointer;
      font-size: 16px;
      padding: 0;
      line-height: 1;
      transition: color 0.2s;
    }
    .conveyor-alert-close:hover { color: #f1f5f9; }
    .conveyor-alert-thumb {
      margin-top: 8px;
      border-radius: 8px;
      overflow: hidden;
      max-height: 80px;
      width: 100%;
      background: #1e293b;
    }
    .conveyor-alert-thumb img {
      width: 100%;
      height: 80px;
      object-fit: cover;
      display: block;
    }
    /* Pulsing badge in top bar */
    #conveyor-alert-badge {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99998;
      background: #ef4444;
      color: white;
      border-radius: 50px;
      padding: 10px 18px;
      font-size: 0.82rem;
      font-weight: 700;
      display: none;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(239,68,68,0.4);
      animation: badgePulse 1.5s ease-in-out infinite;
      cursor: pointer;
    }
    @keyframes badgePulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(239,68,68,0.4); }
      50%       { box-shadow: 0 4px 32px rgba(239,68,68,0.8); }
    }
  `;
  document.head.appendChild(style);

  // ===== DOM: Alert Container =====
  const container = document.createElement('div');
  container.id = 'conveyor-alert-container';
  document.body.appendChild(container);

  // ===== DOM: Persistent Badge =====
  const badge = document.createElement('div');
  badge.id = 'conveyor-alert-badge';
  badge.innerHTML = `<span>🚨</span> <span id="badge-count">0</span> Conveyor Defects`;
  badge.onclick = () => window.location.href = 'imagegallery.html';
  document.body.appendChild(badge);

  let defectCount = 0;

  // ===== AUDIO: Generate alert beep using Web Audio API =====
  function playAlertSound(isCritical) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const freqs = isCritical ? [880, 660, 880] : [660, 0, 660];
      let time = ctx.currentTime;
      freqs.forEach((freq, i) => {
        if (freq === 0) { time += 0.08; return; }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = isCritical ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.18, time + 0.02);
        gain.gain.linearRampToValueAtTime(0.0, time + 0.15);
        osc.start(time);
        osc.stop(time + 0.15);
        time += 0.18;
      });
    } catch (e) { /* Audio blocked */ }
  }

  // ===== Browser Notification =====
  function sendBrowserNotification(title, body) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/frontend/favicon.svg' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification(title, { body });
        });
      }
    }
  }

  // ===== Show Toast Alert =====
  function showAlert(event) {
    const isCritical = event.severity === 'CRITICAL';
    const level = isCritical ? 'critical' : 'warning';

    // Sound
    playAlertSound(isCritical);

    // Browser Notification
    sendBrowserNotification(
      `🚨 Conveyor ${isCritical ? 'CRITICAL' : 'WARNING'} Alert`,
      `${event.detectedDefect} | Defect: ${event.defectPercent}%`
    );

    // Update badge count
    defectCount++;
    badge.style.display = 'flex';
    badge.querySelector('#badge-count').textContent = defectCount;

    // Build toast
    const toast = document.createElement('div');
    toast.className = `conveyor-alert-toast ${level}`;
    toast.innerHTML = `
      <div class="conveyor-alert-icon ${level}">${isCritical ? '🚨' : '⚠️'}</div>
      <div class="conveyor-alert-body">
        <div class="conveyor-alert-title ${level}">${isCritical ? '🔴 CRITICAL DEFECT' : '🟠 WARNING DEFECT'}</div>
        <div class="conveyor-alert-defect">${event.detectedDefect || 'Anomaly Detected'}</div>
        <div class="conveyor-alert-meta">
          <span>📊 ${event.defectPercent}% defect</span>
          <span>🔧 ${event.deviceId || 'ESP32-CAM-01'}</span>
          <span>🕐 ${new Date(event.timestamp).toLocaleTimeString()}</span>
        </div>
        ${event.highlightedImagePath
          ? `<div class="conveyor-alert-thumb"><img src="${event.highlightedImagePath}" alt="Defect highlighted" onerror="this.parentElement.style.display='none'" /></div>`
          : ''}
      </div>
      <button class="conveyor-alert-close" title="Dismiss">✕</button>
    `;

    // Dismiss on close button
    toast.querySelector('.conveyor-alert-close').onclick = () => dismissToast(toast);

    container.appendChild(toast);

    // Auto-dismiss after 10s (WARNING) or 20s (CRITICAL)
    const autoDismissMs = isCritical ? 20000 : 10000;
    setTimeout(() => dismissToast(toast), autoDismissMs);

    // Keep max 4 toasts visible
    while (container.children.length > 4) {
      dismissToast(container.firstChild);
    }
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('exiting');
    setTimeout(() => toast.parentNode && toast.parentNode.removeChild(toast), 400);
  }

  // ===== SSE: Connect to real-time telemetry stream =====
  let sseSource = null;

  function connectSSE() {
    if (sseSource) sseSource.close();
    sseSource = new EventSource(`${API_BASE}/api/telemetry/stream`);

    sseSource.addEventListener('conveyor-defect-alert', (e) => {
      try {
        const data = JSON.parse(e.data);
        showAlert(data);
      } catch (err) { /* parse error */ }
    });

    // Also listen to general telemetry events
    sseSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'conveyor-defect-alert') showAlert(data);
      } catch (err) { /* ignore */ }
    };

    sseSource.onerror = () => {
      // Auto-reconnect after 5s
      setTimeout(connectSSE, 5000);
    };
  }

  // Request notification permission on load
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  connectSSE();
  console.log('✅ Conveyor Alert System active — listening for defects via SSE');
})();
