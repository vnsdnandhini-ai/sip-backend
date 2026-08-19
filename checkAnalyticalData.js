const pool = require('./db');
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'analytical_data'")
  .then(r => { console.log(r.rows); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
