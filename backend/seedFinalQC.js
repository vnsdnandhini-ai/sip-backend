const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const pool = require('../backend/db');

function generateId() {
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

async function createSampleTabletImage(type = 'clean') {
  const width = 400;
  const height = 400;
  // Create blank dark background image
  const image = new Jimp({ width, height, color: 0x0f172aff });

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 130;

  // Draw circular tablet
  image.scan(0, 0, width, height, function (x, y, idx) {
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      // Shading gradient on tablet
      const shade = Math.max(0, 1 - (dist / radius) * 0.25);
      let r = Math.min(255, Math.floor(235 * shade));
      let g = Math.min(255, Math.floor(240 * shade));
      let b = Math.min(255, Math.floor(248 * shade));

      // Tablet score line in center
      if (Math.abs(dx) < 2 && Math.abs(dy) < radius * 0.75) {
        r = 180; g = 190; b = 205;
      }

      if (type === 'chipped') {
        // Chipping defect on top-right edge
        if (dx > 70 && dy < -70 && dist > radius * 0.7) {
          r = 140; g = 100; b = 90; // dark chipped crater
        }
      } else if (type === 'discolored') {
        // Brownish particle spot defect
        if (Math.sqrt((dx - 35) * (dx - 35) + (dy + 25) * (dy + 25)) < 18) {
          r = 165; g = 95; b = 45; // brown foreign particle inclusion
        }
      } else if (type === 'capping') {
        // Capping crack line across tablet
        if (Math.abs(dy + 35) < 3 && Math.abs(dx) < radius * 0.8) {
          r = 130; g = 60; b = 60; // micro-crack
        }
      }

      this.bitmap.data[idx + 0] = r;
      this.bitmap.data[idx + 1] = g;
      this.bitmap.data[idx + 2] = b;
      this.bitmap.data[idx + 3] = 255;
    }
  });

  return await image.getBuffer('image/jpeg');
}

async function seedFinalProductQC() {
  console.log('Seeding Final Product QC sample images...');
  const uploadsDir = path.join(__dirname, '../backend/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Check if we already have final QC images
  const existing = await pool.query("SELECT id FROM analytical_data WHERE process_stage = 'Final QC' OR parameter ILIKE '%Tablet%'");
  if (existing.rows.length >= 4) {
    console.log(`Already have ${existing.rows.length} Final Product QC records.`);
    process.exit(0);
  }

  // Fetch a project/batch id
  const projectRes = await pool.query("SELECT id, name, batch_number FROM projects LIMIT 3");
  const batches = projectRes.rows;
  const batch1 = batches[0]?.id || 'batch-001';
  const batch2 = batches[1]?.id || 'batch-002';
  const batch3 = batches[2]?.id || 'batch-003';

  const samples = [
    {
      type: 'clean',
      param: 'Paracetamol 500mg Tablet Surface Inspection',
      stage: 'Final QC',
      step: 'Stage 8 Visual Release QA',
      batchId: batch1,
      defect: 'None',
      status: 'PASS',
      cond: 'Healthy (Approved Pharmaceutical Standard)',
      defectPercent: 0.2,
      conf: 99.4,
      desc: 'Uniform compression, clean bevel edge, zero foreign particle inclusions.'
    },
    {
      type: 'chipped',
      param: 'Ibuprofen 400mg Compressed Tablet',
      stage: 'Final QC',
      step: 'Stage 8 High-Speed Camera QA',
      batchId: batch2,
      defect: 'Edge Chipping & Surface Crater',
      status: 'CRITICAL',
      cond: 'Defective (Edge Chipping / Friability Failure)',
      defectPercent: 8.45,
      conf: 97.8,
      desc: 'Radial edge break exceeding 2.5mm limit. Tablet friability threshold breached.'
    },
    {
      type: 'clean',
      param: 'Aspirin 100mg Enteric Coated Tablet',
      stage: 'Final QC',
      step: 'Stage 8 Coating Uniformity Inspection',
      batchId: batch3,
      defect: 'None',
      status: 'PASS',
      cond: 'Healthy (Approved Pharmaceutical Standard)',
      defectPercent: 0.4,
      conf: 99.1,
      desc: 'Smooth polymer coat, uniform opacity, flawless logo debossing.'
    },
    {
      type: 'discolored',
      param: 'Acetaminophen 500mg Finished Tablet',
      stage: 'Final QC',
      step: 'Stage 8 Visual Inspection',
      batchId: batch1,
      defect: 'Foreign Particle Surface Contamination',
      status: 'CRITICAL',
      cond: 'Defective (Surface Contamination / Particles)',
      defectPercent: 6.8,
      conf: 98.6,
      desc: 'Extraneous brown particulate spotted at coordinate (235, 175).'
    },
    {
      type: 'capping',
      param: 'Metformin 500mg ER Tablet Press QC',
      stage: 'Compression',
      step: 'Stage 7 Tablet Press In-Line QA',
      batchId: batch2,
      defect: 'Lamination & Transverse Micro-Crack',
      status: 'CRITICAL',
      cond: 'Defective (Tablet Lamination / Capping)',
      defectPercent: 9.15,
      conf: 96.5,
      desc: 'Stress lamination detected along upper punch compression boundary.'
    },
    {
      type: 'clean',
      param: 'Ciprofloxacin 500mg Film Coated Tablet',
      stage: 'Final QC',
      step: 'Stage 8 Optical Sorter Verification',
      batchId: batch3,
      defect: 'None',
      status: 'PASS',
      cond: 'Healthy (Approved Pharmaceutical Standard)',
      defectPercent: 0.15,
      conf: 99.8,
      desc: '100% optical inspection pass. Perfect edge curvature and zero discoloration.'
    }
  ];

  for (const s of samples) {
    const buffer = await createSampleTabletImage(s.type);
    const id = generateId();
    const fileName = `${id}.jpg`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const imagePath = `/uploads/${fileName}`;
    const analysis = {
      width: 400,
      height: 400,
      isPlantLeaf: false,
      condition: s.cond,
      visualQaResult: s.status,
      detectedDefect: s.defect,
      defectPercent: s.defectPercent,
      contaminationPercent: s.defectPercent,
      isContaminated: s.status === 'CRITICAL',
      isDefectiveSample: s.status === 'CRITICAL',
      captureQualityOk: true,
      brightness: 78.4,
      sharpness: 142.5,
      edgeDensityPercent: s.type === 'clean' ? 4.2 : 12.8,
      averageEdgeMagnitude: s.type === 'clean' ? 22.4 : 58.1,
      textureEntropy: 5.42,
      ai: {
        condition: s.cond,
        confidence_score: s.conf,
        visual_qa_result: s.status,
        detected_defect: s.defect,
        defect_percentage: s.defectPercent,
        is_defective: s.status === 'CRITICAL',
        raw_material_class: 'Finished Pharmaceutical Tablet / Final QC'
      }
    };

    await pool.query(
      `INSERT INTO analytical_data (id, device_id, monitoring_point_id, project_id, process_stage, stage_step, defect_tags, sample_metadata, reading_type, parameter, value, device_timestamp, data_type, image_path, image_analysis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id, 'QC-CAMERA-01', null, s.batchId, s.stage, s.step,
        s.defect === 'None' ? 'QC-PASS' : 'QC-DEFECT',
        JSON.stringify({ inspectionNotes: s.desc, targetCategory: 'final_product' }),
        'manual', s.param, imagePath, new Date().toISOString(), 'image', imagePath,
        JSON.stringify(analysis)
      ]
    );
    console.log(`Inserted sample: ${s.param} (${s.status})`);
  }

  console.log('Seeding completed successfully.');
  process.exit(0);
}

seedFinalProductQC().catch(err => {
  console.error('Error seeding Final QC samples:', err);
  process.exit(1);
});
