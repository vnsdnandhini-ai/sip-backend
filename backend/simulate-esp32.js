/**
 * simulate-esp32.js
 *
 * Simulates an ESP32 sending sensor readings to the SIP backend,
 * without needing real hardware. Run this locally, and it behaves
 * exactly like the real ESP32 sketch would over WiFi - same
 * endpoint, same headers, same payload shape.
 *
 * Usage:
 *   node simulate-esp32.js
 *
 * Requires Node 18+ (built-in fetch). If you're on an older Node,
 * run: npm install node-fetch  and uncomment the require line below.
 */

// const fetch = require('node-fetch'); // uncomment if Node < 18

// ---------------------------------------------------------------
// CONFIG - edit these to match your setup
// ---------------------------------------------------------------
const SERVER_URL = 'https://sip-backend-1.onrender.com/api/sensor-data'; // <-- your Render URL here
const DEVICE_ID = 'id-uq98n3qc-1783323629430'; // from your device registration
const API_KEY = 'id-amakt2l5-1783323629431';   // from your device registration
const MONITORING_POINT_ID = 'mp-001';

const SEND_INTERVAL_MS = 180000; // send every 3min

// ---------------------------------------------------------------
// Mock sensor reading generator (same logic as the ESP32 sketch)
// ---------------------------------------------------------------
function generateMockReading() {
  const concentration = +(8 + Math.random() * 7).toFixed(2);   // 8.00 - 15.00
  const temperature = +(20 + Math.random() * 10).toFixed(2);   // 20.00 - 30.00
  return { concentration, temperature };
}

// ---------------------------------------------------------------
// Send one reading to the backend
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// Main loop - mimics ESP32's loop() sending on an interval
// ---------------------------------------------------------------
console.log(`Starting ESP32 simulator...`);
console.log(`Sending to: ${SERVER_URL}`);
console.log(`Interval: every ${SEND_INTERVAL_MS / 1000}s`);
console.log(`Press Ctrl+C to stop.\n`);

sendReading(); // send one immediately on start
setInterval(sendReading, SEND_INTERVAL_MS);
