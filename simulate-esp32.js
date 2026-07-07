const SERVER_URL = 'https://sip-backend-1.onrender.com/api/sensor-data';
const DEVICE_ID = 'id-uq98n3qc-1783323629430';
const API_KEY = 'id-amakt2l5-1783323629431';
const MONITORING_POINT_ID = 'mp-001';

const SEND_INTERVAL_MS = 5000;

function generateMockReading() {
  const concentration = +(8 + Math.random() * 7).toFixed(2);
  const temperature = +(20 + Math.random() * 10).toFixed(2);
  return { concentration, temperature };
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

console.log(`Starting ESP32 simulator...`);
console.log(`Sending to: ${SERVER_URL}`);
console.log(`Interval: every ${SEND_INTERVAL_MS / 1000}s`);
console.log(`Press Ctrl+C to stop.\n`);

sendReading();
setInterval(sendReading, SEND_INTERVAL_MS);
