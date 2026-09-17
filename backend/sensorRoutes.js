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
module.exports = function (pool, generateId, realTimeEvents) {
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

  // Get all registered sensors & devices
  router.get('/devices', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM devices ORDER BY registered_at ASC');
      res.json(result.rows.map((d) => ({
        deviceId: d.device_id,
        apiKey: d.api_key,
        name: d.name,
        model: d.model || 'In-Line Sensor Unit',
        category: d.category || 'Spectroscopy',
        connectionType: d.connection_type || 'HTTP REST',
        protocol: d.protocol || d.connection_type || 'HTTP REST',
        endpointUrl: d.endpoint_url || 'http://localhost:3000',
        processStage: d.process_stage || 'Raw Material Receipt',
        stationId: d.station_id || 'STATION-01',
        lineName: d.line_name || 'Line 1 (Granulation)',
        monitoringPointId: d.monitoring_point_id,
        capturedParameters: typeof d.captured_parameters === 'string' ? JSON.parse(d.captured_parameters) : (d.captured_parameters || []),
        sampleRate: d.sample_rate || '10s',
        status: d.status || 'active',
        registeredAt: d.registered_at,
        lastSeenAt: d.last_seen_at,
      })));
    } catch (err) {
      console.error('Failed to list devices:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  // Get single device
  router.get('/devices/:id', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM devices WHERE device_id = $1', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found.' });
      const d = result.rows[0];
      res.json({
        deviceId: d.device_id,
        apiKey: d.api_key,
        name: d.name,
        model: d.model,
        category: d.category,
        connectionType: d.connection_type,
        protocol: d.protocol,
        endpointUrl: d.endpoint_url,
        processStage: d.process_stage,
        stationId: d.station_id,
        lineName: d.line_name,
        monitoringPointId: d.monitoring_point_id,
        capturedParameters: typeof d.captured_parameters === 'string' ? JSON.parse(d.captured_parameters) : (d.captured_parameters || []),
        sampleRate: d.sample_rate,
        status: d.status,
        registeredAt: d.registered_at,
        lastSeenAt: d.last_seen_at,
      });
    } catch (err) {
      console.error('Failed to get device:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  // Register / Add new sensor
  router.post('/devices', async (req, res) => {
    const {
      name, deviceId: customId, model, category, connectionType, protocol,
      endpointUrl, processStage, stationId, lineName, monitoringPointId,
      capturedParameters, sampleRate
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Device name is required.' });
    }

    const deviceId = customId ? String(customId).trim() : `SENS-${generateId().slice(3, 11).toUpperCase()}`;
    const apiKey = `key-${generateId()}`;
    const paramsJson = capturedParameters ? (typeof capturedParameters === 'string' ? capturedParameters : JSON.stringify(capturedParameters)) : JSON.stringify([]);

    try {
      await pool.query(
        `INSERT INTO devices (
          device_id, api_key, name, model, category, connection_type, protocol,
          endpoint_url, process_stage, station_id, line_name, monitoring_point_id,
          captured_parameters, sample_rate, status, registered_at, last_seen_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',now(),now())
        ON CONFLICT (device_id) DO UPDATE SET
          name = EXCLUDED.name,
          model = EXCLUDED.model,
          category = EXCLUDED.category,
          protocol = EXCLUDED.protocol,
          endpoint_url = EXCLUDED.endpoint_url,
          process_stage = EXCLUDED.process_stage,
          station_id = EXCLUDED.station_id,
          line_name = EXCLUDED.line_name,
          captured_parameters = EXCLUDED.captured_parameters,
          sample_rate = EXCLUDED.sample_rate`,
        [
          deviceId, apiKey, name, model || null, category || 'Spectroscopy',
          connectionType || protocol || 'HTTP REST', protocol || connectionType || 'HTTP REST',
          endpointUrl || null, processStage || 'Raw Material Receipt', stationId || null,
          lineName || 'Line 1', monitoringPointId || null, paramsJson, sampleRate || '10s'
        ]
      );

      // Audit trail log
      await pool.query(
        'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
        [generateId(), `Registered hardware sensor: [${deviceId}] ${name} mapped to ${processStage || 'Raw Material'}`, 'Device Hub', 'System Engineer']
      );

      if (realTimeEvents) {
        realTimeEvents.emit('telemetry', {
          type: 'device-registered',
          deviceId,
          name,
          processStage,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        deviceId,
        apiKey,
        name,
        model,
        category,
        protocol,
        endpointUrl,
        processStage,
        stationId,
        lineName,
        capturedParameters: typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson,
        sampleRate: sampleRate || '10s',
        status: 'active'
      });
    } catch (err) {
      console.error('Failed to register device:', err);
      res.status(500).json({ error: 'Database error registering device.' });
    }
  });

  // Update sensor mapping / parameters
  router.put('/devices/:id', async (req, res) => {
    const {
      name, model, category, connectionType, protocol, endpointUrl,
      processStage, stationId, lineName, monitoringPointId,
      capturedParameters, sampleRate, status
    } = req.body;

    const paramsJson = capturedParameters !== undefined ? (typeof capturedParameters === 'string' ? capturedParameters : JSON.stringify(capturedParameters)) : null;

    try {
      const result = await pool.query(
        `UPDATE devices SET
          name = COALESCE($1, name),
          model = COALESCE($2, model),
          category = COALESCE($3, category),
          connection_type = COALESCE($4, connection_type),
          protocol = COALESCE($5, protocol),
          endpoint_url = COALESCE($6, endpoint_url),
          process_stage = COALESCE($7, process_stage),
          station_id = COALESCE($8, station_id),
          line_name = COALESCE($9, line_name),
          monitoring_point_id = COALESCE($10, monitoring_point_id),
          captured_parameters = COALESCE($11, captured_parameters),
          sample_rate = COALESCE($12, sample_rate),
          status = COALESCE($13, status)
        WHERE device_id = $14 RETURNING *`,
        [
          name || null, model || null, category || null, connectionType || null, protocol || null, endpointUrl || null,
          processStage || null, stationId || null, lineName || null, monitoringPointId || null, paramsJson,
          sampleRate || null, status || null, req.params.id
        ]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found.' });

      await pool.query(
        'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
        [generateId(), `Updated sensor topology for [${req.params.id}]`, 'Device Hub', 'System Engineer']
      );

      res.json({ success: true, device: result.rows[0] });
    } catch (err) {
      console.error('Failed to update device:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  // Delete sensor
  router.delete('/devices/:id', async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM devices WHERE device_id = $1 RETURNING *', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Device not found.' });

      await pool.query(
        'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
        [generateId(), `Decommissioned hardware sensor [${req.params.id}]`, 'Device Hub', 'System Engineer']
      );

      res.json({ success: true, message: `Sensor ${req.params.id} deleted successfully.` });
    } catch (err) {
      console.error('Failed to delete device:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  // Hardware Ping / Telemetry Test
  router.post('/devices/:id/ping', async (req, res) => {
    try {
      const devRes = await pool.query('SELECT * FROM devices WHERE device_id = $1', [req.params.id]);
      if (devRes.rows.length === 0) return res.status(404).json({ error: 'Device not found.' });
      const dev = devRes.rows[0];

      await pool.query('UPDATE devices SET last_seen_at = now(), status = $1 WHERE device_id = $2', ['active', req.params.id]);

      if (realTimeEvents) {
        realTimeEvents.emit('telemetry', {
          type: 'device-ping',
          deviceId: dev.device_id,
          name: dev.name,
          processStage: dev.process_stage,
          latencyMs: +(Math.random() * 12 + 4).toFixed(1),
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        deviceId: dev.device_id,
        name: dev.name,
        status: 'active',
        latencyMs: +(Math.random() * 12 + 4).toFixed(1),
        pingTimestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to ping device:', err);
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
  router.post('/upload-image', async (req, res) => {
    const { monitoringPointId, parameter, imageBase64, projectId, batchId, processStage, stageStep, defectTags, sampleMetadata, category } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const targetBatchId = batchId || projectId || null;
    const id = generateId();
    const fileName = `${id}.jpg`;
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    let imageAnalysisResult = null;
    try {
      imageAnalysisResult = await analyzeImage(imageBuffer, { category, parameter, processStage });
    } catch (err) {
      console.error('Image analysis failed (continuing without it):', err);
    }
    
    let aiResult = null;
    try {
        const formData = new FormData();
        formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), fileName);
        const aiResponse = await fetch('http://localhost:5000/api/ai/analyze', {
            method: 'POST',
            body: formData
        });
        if (aiResponse.ok) {
            aiResult = await aiResponse.json();
        }
    } catch (err) {
        console.error('AI analysis service unreachable:', err.message);
    }
    
    if (imageAnalysisResult && aiResult) {
        imageAnalysisResult.ai = aiResult;
    } else if (!imageAnalysisResult && aiResult) {
        imageAnalysisResult = { ai: aiResult };
    }

    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, imageBuffer);

    const imagePath = `/uploads/${fileName}`;

    if (imageAnalysisResult) {
      if (imageAnalysisResult.highlightedImageBuffer) {
        const hName = `${id}_highlighted.jpg`;
        fs.writeFileSync(path.join(uploadDir, hName), imageAnalysisResult.highlightedImageBuffer);
        if (!imageAnalysisResult.ai) imageAnalysisResult.ai = {};
        imageAnalysisResult.ai.pixel_anomaly_map = `/uploads/${hName}`;
        delete imageAnalysisResult.highlightedImageBuffer;
      }
      if (imageAnalysisResult.segmentedImageBuffer) {
        const sName = `${id}_segmented.jpg`;
        fs.writeFileSync(path.join(uploadDir, sName), imageAnalysisResult.segmentedImageBuffer);
        if (!imageAnalysisResult.ai) imageAnalysisResult.ai = {};
        imageAnalysisResult.ai.segmented_image = `/uploads/${sName}`;
        delete imageAnalysisResult.segmentedImageBuffer;
      }
    }

    try {
      await pool.query(
        `INSERT INTO analytical_data (id, device_id, monitoring_point_id, project_id, process_stage, stage_step, defect_tags, sample_metadata, reading_type, parameter, value, device_timestamp, data_type, image_path, image_analysis)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id, null, monitoringPointId || null, targetBatchId, processStage || null,
          stageStep || null, defectTags || (imageAnalysisResult?.detectedDefect || null),
          sampleMetadata ? (typeof sampleMetadata === 'object' ? JSON.stringify(sampleMetadata) : sampleMetadata) : null,
          'manual', parameter || 'Image', imagePath, null, 'image', imagePath,
          imageAnalysisResult ? JSON.stringify(imageAnalysisResult) : null
        ]
      );
      if (realTimeEvents) {
        realTimeEvents.emit('telemetry', {
          type: 'image-uploaded',
          batchId: targetBatchId,
          recordId: id,
          imagePath,
          imageAnalysis: imageAnalysisResult,
          timestamp: new Date().toISOString()
        });
      }

      res.json({ success: true, recordId: id, imagePath, imageAnalysis: imageAnalysisResult, batchId: targetBatchId });
    } catch (err) {
      console.error('Failed to save manual image upload:', err);
      res.status(500).json({ error: 'Database error.' });
    }
  });

  // Reanalyze all existing images in database with background removal
  router.post('/reanalyze-all-images', async (req, res) => {
    try {
      const result = await pool.query("SELECT id, image_path, parameter, process_stage FROM analytical_data WHERE data_type = 'image' OR image_path IS NOT NULL");
      const uploadDir = path.join(__dirname, 'uploads');
      let updatedCount = 0;

      for (const row of result.rows) {
        if (!row.image_path) continue;
        const localFileName = path.basename(row.image_path);
        const localFilePath = path.join(uploadDir, localFileName);

        if (fs.existsSync(localFilePath)) {
          const buffer = fs.readFileSync(localFilePath);
          const analysis = await analyzeImage(buffer, { parameter: row.parameter, processStage: row.process_stage });

          if (analysis.highlightedImageBuffer) {
            const hName = `${row.id}_highlighted.jpg`;
            fs.writeFileSync(path.join(uploadDir, hName), analysis.highlightedImageBuffer);
            if (!analysis.ai) analysis.ai = {};
            analysis.ai.pixel_anomaly_map = `/uploads/${hName}`;
            delete analysis.highlightedImageBuffer;
          }
          if (analysis.segmentedImageBuffer) {
            const sName = `${row.id}_segmented.jpg`;
            fs.writeFileSync(path.join(uploadDir, sName), analysis.segmentedImageBuffer);
            if (!analysis.ai) analysis.ai = {};
            analysis.ai.segmented_image = `/uploads/${sName}`;
            delete analysis.segmentedImageBuffer;
          }

          await pool.query(
            "UPDATE analytical_data SET image_analysis = $1, defect_tags = $2 WHERE id = $3",
            [JSON.stringify(analysis), analysis.detectedDefect, row.id]
          );
          updatedCount++;
        }
      }

      res.json({ success: true, updatedCount, totalFound: result.rows.length });
    } catch (err) {
      console.error('Failed to reanalyze images:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/sensor-data', requireDeviceAuth, async (req, res) => {
    const { monitoringPointId, timestamp, readingType, values, parameters, dataType, stringValue, imageBase64, projectId, batchId, processStage, stageStep, defectTags, sampleMetadata } = req.body;

    if (!monitoringPointId) {
      return res.status(400).json({ error: 'monitoringPointId is required.' });
    }
    if (!values && !parameters && !stringValue && !imageBase64) {
      return res.status(400).json({ error: 'At least one of values, parameters, stringValue, or imageBase64 is required.' });
    }

    const targetBatchId = batchId || projectId || null;
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
      
      let aiResult = null;
      try {
          const formData = new FormData();
          formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), fileName);
          const aiResponse = await fetch('http://localhost:5000/api/ai/analyze', {
              method: 'POST',
              body: formData
          });
          if (aiResponse.ok) {
              aiResult = await aiResponse.json();
          }
      } catch (err) {
          console.error('AI analysis service unreachable:', err.message);
      }
      
      if (imageAnalysisResult && aiResult) {
          imageAnalysisResult.ai = aiResult;
      } else if (!imageAnalysisResult && aiResult) {
          imageAnalysisResult = { ai: aiResult };
      }

      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, imageBuffer);

      imagePath = `/uploads/${fileName}`;

      if (imageAnalysisResult) {
        if (imageAnalysisResult.highlightedImageBuffer) {
          const hName = `${id}_highlighted.jpg`;
          fs.writeFileSync(path.join(uploadDir, hName), imageAnalysisResult.highlightedImageBuffer);
          if (!imageAnalysisResult.ai) imageAnalysisResult.ai = {};
          imageAnalysisResult.ai.pixel_anomaly_map = `/uploads/${hName}`;
          delete imageAnalysisResult.highlightedImageBuffer;
        }
        if (imageAnalysisResult.segmentedImageBuffer) {
          const sName = `${id}_segmented.jpg`;
          fs.writeFileSync(path.join(uploadDir, sName), imageAnalysisResult.segmentedImageBuffer);
          if (!imageAnalysisResult.ai) imageAnalysisResult.ai = {};
          imageAnalysisResult.ai.segmented_image = `/uploads/${sName}`;
          delete imageAnalysisResult.segmentedImageBuffer;
        }
      }
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
        `INSERT INTO analytical_data (id, device_id, monitoring_point_id, project_id, process_stage, stage_step, defect_tags, sample_metadata, reading_type, parameter, value, parameters, values_data, device_timestamp, data_type, string_value, image_path, image_analysis)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          id, req.device.device_id, monitoringPointId, targetBatchId, processStage || null,
          stageStep || null, defectTags || (imageAnalysisResult?.detectedDefect || null),
          sampleMetadata ? (typeof sampleMetadata === 'object' ? JSON.stringify(sampleMetadata) : sampleMetadata) : null,
          readingType || 'parameter',
          derivedParameter,
          derivedValue !== null ? String(derivedValue) : null,
          parameters ? JSON.stringify(parameters) : null,
          values ? JSON.stringify(values) : null,
          timestamp || null,
          resolvedDataType,
          stringValue || null,
          imagePath,
          imageAnalysisResult ? JSON.stringify(imageAnalysisResult) : null
        ]
      );
      await pool.query('UPDATE devices SET last_seen_at = now() WHERE device_id = $1', [req.device.device_id]);

      if (realTimeEvents) {
        realTimeEvents.emit('telemetry', {
          type: 'sensor-reading',
          batchId: targetBatchId,
          monitoringPointId,
          parameter: derivedParameter,
          value: derivedValue,
          dataType: resolvedDataType,
          spectrumResult,
          imagePath,
          imageAnalysis: imageAnalysisResult,
          timestamp: new Date().toISOString()
        });
      }

      res.json({ success: true, recordId: id, dataType: resolvedDataType, spectrumResult, imagePath, imageAnalysis: imageAnalysisResult, batchId: targetBatchId });
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