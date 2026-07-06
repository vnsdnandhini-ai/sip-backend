/**
 * sensorRoutes.js
 *
 * Handles data ingestion from ESP32 / sensor gateway devices.
 * Kept separate from the human-facing API (/api/projects, /api/rules, etc.)
 * because devices authenticate differently (API key, not username/password).
 *
 * Mount this in server.js with:
 *   const sensorRoutes = require('./sensorRoutes');
 *   app.use('/api', sensorRoutes(readData, writeData, generateId));
 */

const express = require('express');

module.exports = function (readData, writeData, generateId) {
  const router = express.Router();

  // --- Simple device auth middleware -----------------------------------
  // Each ESP32 is issued a deviceId + apiKey pair, stored in data.devices.
  // This is intentionally simple for the trial phase; swap for signed
  // tokens / mutual TLS later if this goes to production.
  function requireDeviceAuth(req, res, next) {
    const deviceId = req.header('x-device-id');
    const apiKey = req.header('x-api-key');

    if (!deviceId || !apiKey) {
      return res.status(401).json({ error: 'Missing device credentials.' });
    }

    const data = readData();
    const device = (data.devices || []).find((d) => d.deviceId === deviceId);

    if (!device || device.apiKey !== apiKey) {
      return res.status(403).json({ error: 'Invalid device credentials.' });
    }

    if (device.status !== 'active') {
      return res.status(403).json({ error: 'Device is not active.' });
    }

    req.device = device;
    next();
  }

  // --- Register a new device (called manually by you, not by ESP32) ----
  // Use this once per ESP32 to create its credentials before deployment.
  router.post('/devices', (req, res) => {
    const { name, connectionType, monitoringPointId } = req.body;

    if (!name || !connectionType) {
      return res.status(400).json({ error: 'name and connectionType are required.' });
    }

    const validTypes = ['USB', 'UART', 'RS485'];
    if (!validTypes.includes(connectionType)) {
      return res.status(400).json({ error: `connectionType must be one of ${validTypes.join(', ')}.` });
    }

    const data = readData();
    if (!data.devices) data.devices = [];

    const device = {
      deviceId: generateId(),
      apiKey: generateId(),
      name,
      connectionType,
      monitoringPointId: monitoringPointId || null,
      status: 'active',
      registeredAt: new Date().toISOString(),
      lastSeenAt: null,
    };

    data.devices.push(device);
    writeData(data);

    // Return credentials once — the ESP32 sketch needs deviceId + apiKey.
    res.json(device);
  });

  router.get('/devices', (req, res) => {
    const data = readData();
    res.json(data.devices || []);
  });

  // --- Main ingestion endpoint -------------------------------------------
  // ESP32 posts here on every reading (or batch of readings).
  //
  // Expected payload shape:
  // {
  //   "monitoringPointId": "mp-001",     // which process point this reading belongs to
  //   "timestamp": "2026-07-06T10:15:00Z", // ISO string; ESP32 can send device time or omit and let server stamp it
  //   "readingType": "spectral",          // "spectral" | "parameter"
  //   "values": {                          // flexible: raw spectrum OR derived parameter values
  //     "wavelengths": [400, 410, 420],
  //     "intensities": [0.12, 0.34, 0.31]
  //   },
  //   "parameters": {                      // optional derived/computed values
  //     "concentration": 12.4,
  //     "temperature": 24.8
  //   }
  // }
  router.post('/sensor-data', requireDeviceAuth, (req, res) => {
    const { monitoringPointId, timestamp, readingType, values, parameters } = req.body;

    if (!monitoringPointId) {
      return res.status(400).json({ error: 'monitoringPointId is required.' });
    }
    if (!values && !parameters) {
      return res.status(400).json({ error: 'At least one of values or parameters is required.' });
    }

    const data = readData();

    const record = {
      id: generateId(),
      deviceId: req.device.deviceId,
      monitoringPointId,
      readingType: readingType || 'parameter',
      values: values || null,
      parameters: parameters || null,
      // Prefer server-received time for audit integrity; keep device timestamp for reference.
      receivedAt: new Date().toISOString(),
      deviceTimestamp: timestamp || null,
    };

    data.analyticalData.push(record);

    // Update device last-seen so you can tell if an ESP32 has gone offline.
    const deviceIndex = data.devices.findIndex((d) => d.deviceId === req.device.deviceId);
    if (deviceIndex !== -1) {
      data.devices[deviceIndex].lastSeenAt = record.receivedAt;
    }

    writeData(data);
    res.json({ success: true, recordId: record.id });
  });

  // --- Batch ingestion (optional) ----------------------------------------
  // If an ESP32 buffers readings and sends several at once (e.g. every
  // 30s instead of every reading), use this instead.
  router.post('/sensor-data/batch', requireDeviceAuth, (req, res) => {
    const { readings } = req.body;

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: 'readings must be a non-empty array.' });
    }

    const data = readData();
    const now = new Date().toISOString();

    const records = readings.map((r) => ({
      id: generateId(),
      deviceId: req.device.deviceId,
      monitoringPointId: r.monitoringPointId,
      readingType: r.readingType || 'parameter',
      values: r.values || null,
      parameters: r.parameters || null,
      receivedAt: now,
      deviceTimestamp: r.timestamp || null,
    }));

    data.analyticalData.push(...records);

    const deviceIndex = data.devices.findIndex((d) => d.deviceId === req.device.deviceId);
    if (deviceIndex !== -1) {
      data.devices[deviceIndex].lastSeenAt = now;
    }

    writeData(data);
    res.json({ success: true, count: records.length });
  });

  return router;
};
