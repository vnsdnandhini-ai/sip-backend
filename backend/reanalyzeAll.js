const pool = require('./db');
const path = require('path');
const fs = require('fs');
const { analyzeImage } = require('./imageAnalysis');

async function reanalyzeAll() {
  console.log('--- RE-ANALYZING ALL STORED IMAGES WITH IIT CV ENGINE ---');
  try {
    const res = await pool.query(`SELECT id, image_path, parameter, process_stage FROM analytical_data WHERE image_path IS NOT NULL OR data_type = 'image'`);
    console.log(`Found ${res.rows.length} image records in analytical_data.`);

    let updatedCount = 0;

    for (const row of res.rows) {
      if (!row.image_path) continue;
      // Resolve path
      let cleanPath = row.image_path.replace(/^\/?(uploads\/|api\/uploads\/)?/, '');
      let fullPath = path.join(__dirname, 'uploads', cleanPath);

      if (!fs.existsSync(fullPath)) {
        fullPath = path.resolve(__dirname, row.image_path);
      }
      if (!fs.existsSync(fullPath)) {
        fullPath = path.join(__dirname, 'uploads', path.basename(row.image_path));
      }

      if (fs.existsSync(fullPath)) {
        const imgBuffer = fs.readFileSync(fullPath);
        const analysis = await analyzeImage(imgBuffer, {
          parameter: row.parameter,
          processStage: row.process_stage
        });

        // Strip binary buffers for JSON storage
        const analysisToStore = {
          ...analysis,
          highlightedImageBuffer: undefined,
          segmentedImageBuffer: undefined,
        };

        await pool.query(
          `UPDATE analytical_data SET image_analysis = $1 WHERE id = $2`,
          [JSON.stringify(analysisToStore), row.id]
        );
        updatedCount++;
        console.log(`[OK] Updated record ${row.id} (${row.parameter}): DLA=${analysis.defectPercent}%, HB=${analysis.hbGrade}, Lesions=${analysis.lesionCount}`);
      } else {
        console.warn(`[WARN] Image file not found for record ${row.id}: ${row.image_path}`);
      }
    }

    console.log(`\nSuccessfully re-analyzed ${updatedCount} records with IIT Foliar Pathometry Suite!`);
    process.exit(0);
  } catch (err) {
    console.error('Re-analysis error:', err);
    process.exit(1);
  }
}

reanalyzeAll();
