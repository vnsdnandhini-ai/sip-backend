/**
 * sensorRoutes.js (database version)
 *
 * Handles device registration and sensor data ingestion, now backed
 * by Postgres instead of file storage.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const supabase = require('./supabaseClient');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const { findBestMatch } = require('./spectrumSimilarity');
const { analyzeImage } = require('./imageAnalysis');
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

  router.post('/reference-spectrum', async (req, res) => {
    const { parameter, monitoringPointId, variantName, xValues, yValues } = req.body;

    if (!parameter || !xValues || !yValues || xValues.length !== yValues.length) {
      return res.status(400).json({ error: 'parameter, xValues, and yValues (equal length) are required.' });
    }

    const id = generateId();
    const referenceCurve = JSON.stringify({ xValues, yValues });

    try {
      await pool.query(
        'INSERT INTO reference_spectra (id, parameter, monitoring_point_id, variant_name, reference_curve, is_active) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, parameter, monitoringPointId || null, variantName || null, referenceCurve, true]
      );
      res.json({ id, parameter, monitoringPointId, variantName, xValues, yValues });
    } catch (err) {
      console.error('Failed to save reference spectrum:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });
router.post('/reference-color', async (req, res) => {
    const { parameter, monitoringPointId, label, r, g, b } = req.body;

    if (!parameter || r === undefined || g === undefined || b === undefined) {
      return res.status(400).json({ error: 'parameter, r, g, and b are required.' });
    }

    const id = generateId();

    try {
      await pool.query(
        'INSERT INTO reference_colors (id, parameter, monitoring_point_id, label, r, g, b, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, parameter, monitoringPointId || null, label || null, r, g, b, true]
      );
      res.json({ id, parameter, monitoringPointId, label, r, g, b });
    } catch (err) {
      console.error('Failed to save reference color:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  router.post('/sensor-data', requireDeviceAuth, async (req, res) => {
    const { monitoringPointId, timestamp, readingType, values, parameters, dataType, stringValue, imageBase64 } = req.body;

    if (!monitoringPointId) {
      return res.status(400).json({ error: 'monitoringPointId is required.' });
    }
 if (!values && !parameters && !stringValue && !imageBase64) {
  return res.status(400).json({ error: 'At least one of values, parameters, stringValue, or imageBase64 is required.' });
}

    const id = generateId();
    const resolvedDataType = dataType || (stringValue ? 'string' : 'number');

    let spectrumResult = null;

    if (resolvedDataType === 'spectrum') {
      const { xValues: spectrumX, yValues: spectrumY } = values || {};

      if (!spectrumX || !spectrumY) {
        return res.status(400).json({ error: 'Spectrum readings require values.xValues and values.yValues.' });
      }
      if (!parameters || !parameters.parameter) {
        return res.status(400).json({ error: 'Spectrum readings require parameters.parameter.' });
      }

      const refResult = await pool.query(
        'SELECT * FROM reference_spectra WHERE parameter = $1 AND is_active = true',
        [parameters.parameter]
      );
      if (refResult.rows.length === 0) {
        return res.status(400).json({ error: `No active reference spectra found for parameter "${parameters.parameter}".` });
      }

      const referenceVariants = refResult.rows.map((r) => ({
        variantName: r.variant_name,
        referenceCurve: { x: r.reference_curve.xValues, y: r.reference_curve.yValues },
      }));

      spectrumResult = findBestMatch({ x: spectrumX, y: spectrumY }, referenceVariants);
    }
let derivedParameter = null;
    let derivedValue = null;

    if (resolvedDataType === 'spectrum' && spectrumResult) {
      derivedParameter = parameters.parameter;
      derivedValue = spectrumResult.bestSimilarity;
    }

    let imagePath = null;
    let imageAnalysisResult = null;

    if (resolvedDataType === 'image') {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'Image readings require imageBase64.' });
      }

      const fileName = `${id}.jpg`;
      const imageBuffer = Buffer.from(imageBase64, 'base64');

      const imageParameter = (parameters && parameters.parameter) || null;
      let referenceColor = null;

      if (imageParameter) {
        const scopedRef = await pool.query(
          'SELECT r, g, b FROM reference_colors WHERE parameter = $1 AND monitoring_point_id = $2 AND is_active = true LIMIT 1',
          [imageParameter, monitoringPointId]
        );
        if (scopedRef.rows.length > 0) {
          referenceColor = scopedRef.rows[0];
        } else {
          const globalRef = await pool.query(
            'SELECT r, g, b FROM reference_colors WHERE parameter = $1 AND monitoring_point_id IS NULL AND is_active = true LIMIT 1',
            [imageParameter]
          );
          if (globalRef.rows.length > 0) {
            referenceColor = globalRef.rows[0];
          }
        }
      }

      try {
        imageAnalysisResult = await analyzeImage(imageBuffer, referenceColor);
      } catch (err) {
        console.error('Image analysis failed (continuing without it):', err);
      }

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, imageBuffer, { contentType: 'image/jpeg' });

      if (uploadError) {
        console.error('Failed to upload image to Supabase:', uploadError);
        return res.status(500).json({ error: 'Failed to save image file.' });
      }

      const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(fileName);
      imagePath = publicUrlData.publicUrl;
    }
if (resolvedDataType === 'image') {
      derivedParameter = 'Image';
      derivedValue = imagePath;
    }
    if (resolvedDataType === 'string') {
      derivedParameter = (parameters && parameters.parameter) || 'Status';
      derivedValue = stringValue;
    }
    try {
     await pool.query(
        `INSERT INTO analytical_data (id, device_id, monitoring_point_id, reading_type, parameter, value, parameters, values_data, device_timestamp, data_type, string_value, image_path, image_analysis)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, req.device.device_id, monitoringPointId, readingType || 'parameter',
          derivedParameter,
          derivedValue !== null ? String(derivedValue) : null,
          parameters ? JSON.stringify(parameters) : null,
          values ? JSON.stringify(values) : null,
          timestamp || null,
          resolvedDataType,
          stringValue || null,
          imagePath,
          imageAnalysisResult ? JSON.stringify(imageAnalysisResult) : null]
      );
      await pool.query('UPDATE devices SET last_seen_at = now() WHERE device_id = $1', [req.device.device_id]);

      res.json({ success: true, recordId: id, dataType: resolvedDataType, spectrumResult, imagePath, imageAnalysis: imageAnalysisResult });
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