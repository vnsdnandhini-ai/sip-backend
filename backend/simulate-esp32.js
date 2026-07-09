/**
 * simulate-esp32.js
 *
 * Simulates an ESP32 sending sensor readings to the SIP backend,
 * without needing real hardware.
 *
 * Updated to generate a REALISTIC MIX of values across the full
 * range - mostly within acceptance limits (like a stable process),
 * occasionally drifting into warning territory, and rarely into
 * critical territory (like a real process upset would look).
 *
 * Distribution (per reading, independently for concentration and temperature):
 *   80% chance -> within acceptance range
 *   15% chance -> within warning range
 *   5%  chance -> within critical range
 *
 * This matches how real process data actually looks - not everything
 * is a clean PASS, which is what makes a compliance engine worth having.
 *
 * Usage:
 *   node simulate-esp32.js
 */

const SERVER_URL = 'https://sip-backend-1.onrender.com/api/sensor-data';
const DEVICE_ID = 'id-uq98n3qc-1783323629430';
const API_KEY = 'id-amakt2l5-1783323629431';
const MONITORING_POINT_ID = 'mp-001';

const SEND_INTERVAL_MS = 180000; // every 3 minutes

// Matches your stored checkoutConditions exactly:
// concentration: acceptance 8-15, warning 5-8, critical <5
// temperature:   acceptance 20-30, warning 15-20, critical <15
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
  return randomInRange(2, 5); // critical: below 5
}

function generateTemperature() {
  const band = pickBand();
  if (band === 'acceptance') return randomInRange(20, 30);
  if (band === 'warning') return randomInRange(15, 20);
  return randomInRange(10, 15); // critical: below 15
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
