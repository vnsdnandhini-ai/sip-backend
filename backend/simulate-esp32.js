const SERVER_URL = 'https://sip-backend-1.onrender.com/api/sensor-data';
const DEVICE_ID = 'id-uq98n3qc-1783323629430';
const API_KEY = 'id-amakt2l5-1783323629431';
const MONITORING_POINT_ID = 'mp-001';

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

// Matches the real spectroscopic checkoutConditions defined on the backend
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

function generateFtirPeakIntensity() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(400, 500);
  if (band === 'warning') return randomInRange(300, 399);
  return randomInRange(150, 299);
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

function generatePh() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(6.5, 7.5);
  if (band === 'warning') return randomInRange(6, 6.4);
  return randomInRange(4, 5.9);
}

function generateMockReading() {
  return {
    'Raman Spectral Similarity': generateRamanSpectralSimilarity(),
    'NIR Absorbance': generateNirAbsorbance(),
    'FTIR Peak Intensity': generateFtirPeakIntensity(),
    'Moisture Content': generateMoistureContent(),
    'Particle Size': generateParticleSize(),
    'pH': generatePh(),
  };
}

async function sendReading() {
  const readings = generateMockReading();

  const payload = {
    monitoringPointId: MONITORING_POINT_ID,
    readingType: 'parameter',
    parameters: readings,
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
      console.log(`[${new Date().toLocaleTimeString()}] Sent ->`, readings, `| recordId: ${data.recordId}`);
    } else {
      console.error(`[${new Date().toLocaleTimeString()}] Server error:`, data);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Failed to send reading:`, err.message);
  }
}

console.log(`Starting ESP32 simulator (spectroscopic parameters mode)...`);
console.log(`Sending to: ${SERVER_URL}`);
console.log(`Interval: every ${SEND_INTERVAL_MS / 1000}s`);
console.log(`Parameters: Raman Spectral Similarity, NIR Absorbance, FTIR Peak Intensity, Moisture Content, Particle Size, pH`);
console.log(`Press Ctrl+C to stop.\n`);

sendReading();
setInterval(sendReading, SEND_INTERVAL_MS);
