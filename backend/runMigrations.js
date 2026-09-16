const pool = require('./db');

async function runMigrations() {
  try {
    console.log('Checking database schema...');

      const safeAlter = async (query) => {
        try {
          await pool.query(query);
        } catch (e) {
          // ignore already exists or minor schema errors
        }
      };

      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS process_stage VARCHAR(255);`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS stage_step VARCHAR(255);`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS defect_tags VARCHAR(255);`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS sample_metadata TEXT;`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS instrument VARCHAR(255);`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS result VARCHAR(50);`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS data_type VARCHAR(50);`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS image_path VARCHAR(500);`);
      await safeAlter(`ALTER TABLE analytical_data ADD COLUMN IF NOT EXISTS image_analysis JSONB;`);

      // Add pharmaceutical fields to projects (batches)
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS material_id VARCHAR(255);`);
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS material_name VARCHAR(255);`);
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS supplier VARCHAR(255);`);
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_quantity NUMERIC;`);
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_quantity NUMERIC;`);
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS weight_deviation NUMERIC;`);
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_stage VARCHAR(255) DEFAULT 'Raw Material Receipt';`);
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS qc_status VARCHAR(255) DEFAULT 'In Progress';`);
      await safeAlter(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT;`);

      // Create dispensing logs table for Stage 2
      await safeAlter(`
        CREATE TABLE IF NOT EXISTS dispensing_logs (
          id VARCHAR(255) PRIMARY KEY,
          batch_id VARCHAR(255),
          material_id VARCHAR(255),
          material_name VARCHAR(255),
          lot_number VARCHAR(255),
          target_quantity NUMERIC,
          actual_quantity NUMERIC,
          deviation_percent NUMERIC,
          operator_name VARCHAR(255),
          status VARCHAR(50) DEFAULT 'PASS',
          timestamp TIMESTAMPTZ DEFAULT now()
        );
      `);
      console.log('Schema check complete.');
    } catch (err) {
      console.error('Migration failed:', err);
    }
}

if (require.main === module) {
  runMigrations().then(() => {
    console.log('Migration finished');
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = runMigrations;


