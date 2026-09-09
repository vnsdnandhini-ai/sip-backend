const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000/api/sensor-data';
const DEVICE_ID = process.env.DEVICE_ID || 'id-11ifdn9h-1784173538536';
const API_KEY = process.env.API_KEY || 'id-hl276jff-1784173538537';
const MONITORING_POINT_ID = 'mp-001';

const SEND_INTERVAL_MS = 20000; // every 20 seconds for faster testing

function randomInRange(min, max) {
  return +(min + Math.random() * (max - min)).toFixed(2);
}

function pickBand() {
  const roll = Math.random();
  if (roll < 0.80) return 'acceptance';
  if (roll < 0.95) return 'warning';
  return 'critical';
}

function generateConcentration() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(8, 15);
  if (band === 'warning') return randomInRange(5, 8);
  return randomInRange(2, 5);
}

function generateTemperature() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(20, 30);
  if (band === 'warning') return randomInRange(15, 20);
  return randomInRange(10, 15);
}

function generateMockReading() {
  return {
    concentration: generateConcentration(),
    temperature: generateTemperature(),
  };
}

async function sendReading() {
  const { concentration, temperature } = generateMockReading();

  const payload = {
    monitoringPointId: MONITORING_POINT_ID,
    readingType: 'parameter',
    parameters: { concentration, temperature },
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
      console.log(
        `[${new Date().toLocaleTimeString()}] Sent -> concentration: ${concentration}, temperature: ${temperature} | recordId: ${data.recordId}`
      );
    } else {
      console.error(`[${new Date().toLocaleTimeString()}] Server error:`, data);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Failed to send reading:`, err.message);
  }
}

console.log(`Starting ESP32 simulator (realistic mix mode)...`);
console.log(`Sending to: ${SERVER_URL}`);
console.log(`Interval: every ${SEND_INTERVAL_MS / 1000}s`);
console.log(`Distribution: 80% acceptance, 15% warning, 5% critical`);
console.log(`Press Ctrl+C to stop.\n`);

sendReading();
setInterval(sendReading, SEND_INTERVAL_MS);