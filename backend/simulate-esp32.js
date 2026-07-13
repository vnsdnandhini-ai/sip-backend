const SERVER_URL = 'https://sip-backend-1.onrender.com/api/sensor-data';
const DEVICE_ID = 'id-uq98n3qc-1783323629430';
const API_KEY = 'id-amakt2l5-1783323629431';

// Real monitoring points created in the backend
const MONITORING_POINTS = [
  { id: 'id-cwfzlpkg-1783918823703', name: 'Raw Material Inspection', parameter: 'NIR Absorbance', generator: () => generateNirAbsorbance() },
  { id: 'id-egpyg3rz-1783918832378', name: 'Blending Stage', parameter: 'Raman Spectral Similarity', generator: () => generateRamanSpectralSimilarity() },
  { id: 'id-1nga3q5u-1783918840637', name: 'Compression Stage', parameters: ['Moisture Content', 'Particle Size'] },
];

const SEND_INTERVAL_MS = 20000; // every 20 seconds for testing

function randomInRange(min, max) {
  return +(min + Math.random() * (max - min)).toFixed(2);
}

function pickBand() {
  const roll = Math.random();
  if (roll < 0.80) return 'acceptance';
  if (roll < 0.95) return 'warning';
  return 'critical';
}

function generateRamanSpectralSimilarity() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(85, 100);
  if (band === 'warning') return randomInRange(70, 84);
  return randomInRange(40, 69);
}

function generateNirAbsorbance() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(0.8, 1.2);
  if (band === 'warning') return randomInRange(0.6, 0.79);
  return randomInRange(0.2, 0.59);
}

function generateMoistureContent() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(2, 4);
  if (band === 'warning') return randomInRange(4, 5);
  return randomInRange(5.1, 8);
}

function generateParticleSize() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(50, 150);
  if (band === 'warning') return randomInRange(30, 49);
  return randomInRange(5, 29);
}

let pointIndex = 0;

async function sendReading() {
  const point = MONITORING_POINTS[pointIndex];
  pointIndex = (pointIndex + 1) % MONITORING_POINTS.length;

  let parameters = {};
  if (point.id === 'id-cwfzlpkg-1783918823703') {
    parameters = { 'NIR Absorbance': generateNirAbsorbance() };
  } else if (point.id === 'id-egpyg3rz-1783918832378') {
    parameters = { 'Raman Spectral Similarity': generateRamanSpectralSimilarity() };
  } else if (point.id === 'id-1nga3q5u-1783918840637') {
    parameters = { 'Moisture Content': generateMoistureContent(), 'Particle Size': generateParticleSize() };
  }

  const payload = {
    monitoringPointId: point.id,
    readingType: 'parameter',
    parameters,
  };

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': DEVICE_ID,
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[${new Date().toLocaleTimeString()}] Sent to ${point.name} ->`, parameters, `| recordId: ${data.recordId}`);
    } else {
      console.error(`[${new Date().toLocaleTimeString()}] Server error:`, data);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Failed to send reading:`, err.message);
  }
}

console.log(`Starting ESP32 simulator (multi-monitoring-point mode)...`);
console.log(`Rotating across: ${MONITORING_POINTS.map((p) => p.name).join(', ')}`);
console.log(`Interval: every ${SEND_INTERVAL_MS / 1000}s`);
console.log(`Press Ctrl+C to stop.\n`);

sendReading();
setInterval(sendReading, SEND_INTERVAL_MS);
