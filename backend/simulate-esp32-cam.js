const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000';
const DEVICE_ID = 'ESP32-CAM-01';

// Base64 string for a simple 1x1 black pixel, just to simulate stream
// We will toggle between two very small base64 images to simulate movement/frames
const frameA = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // Transparent/Blackish
const frameB = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='; // White

let useFrameA = true;

async function sendFrame() {
  const base64Image = useFrameA ? frameA : frameB;
  useFrameA = !useFrameA;

  try {
    const response = await axios.post(`${BACKEND_URL}/api/esp32-cam/frame?deviceId=${DEVICE_ID}`, {
      image: base64Image
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': DEVICE_ID
      }
    });
    console.log(`[ESP32 SIMULATOR] Sent frame. Status: ${response.status}`);
  } catch (err) {
    console.error(`[ESP32 SIMULATOR] Failed to send frame:`, err.message);
  }
}

// Send a frame every 1 second
console.log(`Starting ESP32 CAM Simulator for device: ${DEVICE_ID}`);
setInterval(sendFrame, 1000);
