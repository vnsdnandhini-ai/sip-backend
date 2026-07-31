const pool = require('./db');
pool.query('DELETE FROM reference_spectra WHERE id = $1', ['id-z3ygum75-1784638529048'])
  .then(() => { console.log('reference deleted'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
