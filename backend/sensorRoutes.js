/**
 * sensorRoutes.js (database version)
 *
 * Handles device registration and sensor data ingestion, now backed
 * by Postgres instead of file storage.
 */

const express = require('express');

module.exports = function (pool, generateId) {
  const router = express.Router();

  async function requireDeviceAuth(req, res, next) {
    const deviceId = req.header('x-device-id');
    const apiKey = req.header('x-api-key');

    if (!deviceId || !apiKey) {
      return res.status(401).json({ error: 'Missing device credentials.' });
    }

    try {
      const result = await pool.query('SELECT * FROM devices WHERE device_id = $1', [deviceId]);
      const device = result.rows[0];

      if (!device || device.api_key !== apiKey) {
        return res.status(403).json({ error: 'Invalid device credentials.' });
      }
      if (device.status !== 'active') {
        return res.status(403).json({ error: 'Device is not active.' });
      }

      req.device = device;
      next();
    } catch (err) {
      console.error('Device auth error:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  }

  router.post('/devices', async (req, res) => {
    const { name, connectionType, monitoringPointId } = req.body;

    if (!name || !connectionType) {
      return res.status(400).json({ error: 'name and connectionType are required.' });
    }
    const validTypes = ['USB', 'UART', 'RS485'];
    if (!validTypes.includes(connectionType)) {
      return res.status(400).json({ error: `connectionType must be one of ${validTypes.join(', ')}.` });
    }

    const deviceId = generateId();
    const apiKey = generateId();

    try {
      await pool.query(
        'INSERT INTO devices (device_id, api_key, name, connection_type, monitoring_point_id, status) VALUES ($1,$2,$3,$4,$5,$6)',
        [deviceId, apiKey, name, connectionType, monitoringPointId || null, 'active']
      );
      res.json({ deviceId, apiKey, name, connectionType, monitoringPointId, status: 'active' });
    } catch (err) {
      console.error('Failed to register device:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.get('/devices', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM devices');
      res.json(result.rows.map((d) => ({
        deviceId: d.device_id, apiKey: d.api_key, name: d.name,
        connectionType: d.connection_type, monitoringPointId: d.monitoring_point_id,
        status: d.status, registeredAt: d.registered_at, lastSeenAt: d.last_seen_at,
      })));
    } catch (err) {
      console.error('Failed to list devices:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.post('/sensor-data', requireDeviceAuth, async (req, res) => {
    const { monitoringPointId, timestamp, readingType, values, parameters } = req.body;

    if (!monitoringPointId) {
      return res.status(400).json({ error: 'monitoringPointId is required.' });
    }
    if (!values && !parameters) {
      return res.status(400).json({ error: 'At least one of values or parameters is required.' });
    }

    const id = generateId();

    try {
      await pool.query(
        `INSERT INTO analytical_data (id, device_id, monitoring_point_id, reading_type, parameters, values_data, device_timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, req.device.device_id, monitoringPointId, readingType || 'parameter',
          parameters ? JSON.stringify(parameters) : null,
          values ? JSON.stringify(values) : null,
          timestamp || null]
      );
      await pool.query('UPDATE devices SET last_seen_at = now() WHERE device_id = $1', [req.device.device_id]);

      res.json({ success: true, recordId: id });
    } catch (err) {
      console.error('Failed to save sensor data:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.post('/sensor-data/batch', requireDeviceAuth, async (req, res) => {
    const { readings } = req.body;
    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: 'readings must be a non-empty array.' });
    }

    try {
      for (const r of readings) {
        const id = generateId();
        await pool.query(
          `INSERT INTO analytical_data (id, device_id, monitoring_point_id, reading_type, parameters, values_data, device_timestamp)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, req.device.device_id, r.monitoringPointId, r.readingType || 'parameter',
            r.parameters ? JSON.stringify(r.parameters) : null,
            r.values ? JSON.stringify(r.values) : null,
            r.timestamp || null]
        );
      }
      await pool.query('UPDATE devices SET last_seen_at = now() WHERE device_id = $1', [req.device.device_id]);
      res.json({ success: true, count: readings.length });
    } catch (err) {
      console.error('Failed to save batch:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.delete('/sensor-data/range', async (req, res) => {
    const { startDate, endDate } = req.body;
    try {
      const result = await pool.query(
        `DELETE FROM analytical_data
         WHERE ($1::timestamptz IS NULL OR received_at >= $1)
         AND ($2::timestamptz IS NULL OR received_at <= $2)
         RETURNING id`,
        [startDate || null, endDate || null]
      );
      res.json({ success: true, deleted: result.rows.length });
    } catch (err) {
      console.error('Failed to delete range:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.delete('/sensor-data/:id', async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM analytical_data WHERE id=$1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Reading not found.' });
      res.json({ success: true, deletedId: req.params.id });
    } catch (err) {
      console.error('Failed to delete reading:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.delete('/sensor-data', async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM analytical_data RETURNING id');
      res.json({ success: true, cleared: result.rows.length });
    } catch (err) {
      console.error('Failed to clear sensor data:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  return router;
};
