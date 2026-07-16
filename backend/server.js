const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('./db');
const { getFullState } = require('./dataAccess');
const sensorRoutes = require('./sensorRoutes');
const complianceRoutes = require('./complianceRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

function generateId() {
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

app.get('/api/state', async (req, res) => {
  try {
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    console.error('Failed to get state:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Auth ---
app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const id = generateId();
    await pool.query(
      'INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
      [id, username, passwordHash, role || 'operator']
    );
    res.json({ user: { id, username, role: role || 'operator' } });
  } catch (err) {
    console.error('Register failed:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const passwordMatches = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    res.json({ user: { id: user.id, username: user.username, role: user.role }, token: generateId() });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Audit ---
app.post('/api/audit', async (req, res) => {
  const { activity, module, user } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO audit_trail (id, activity, module, user_name) VALUES ($1, $2, $3, $4)',
      [id, activity, module, user]
    );
    res.json({ id, activity, module, user });
  } catch (err) {
    console.error('Failed to record audit entry:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Projects ---
app.post('/api/projects', async (req, res) => {
  const { name, product, batchNumber, department, line, status } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO projects (id, name, product, batch_number, department, line, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, name, product, batchNumber, department, line, status || 'Active']
    );
    res.json({ id, name, product, batchNumber, department, line, status: status || 'Active' });
  } catch (err) {
    console.error('Failed to create project:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  const { name, product, batchNumber, department, line, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE projects SET name=$1, product=$2, batch_number=$3, department=$4, line=$5, status=$6 WHERE id=$7 RETURNING *',
      [name, product, batchNumber, department, line, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update project:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete project:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Monitoring Points ---
app.post('/api/monitoring', async (req, res) => {
  const { name, location, frequency, description, status } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO monitoring_points (id, name, location, frequency, description, status) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, name, location, frequency, description, status || 'Active']
    );
    res.json({ id, name, location, frequency, description, status: status || 'Active' });
  } catch (err) {
    console.error('Failed to create monitoring point:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/monitoring/:id', async (req, res) => {
  const { name, location, frequency, description, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE monitoring_points SET name=$1, location=$2, frequency=$3, description=$4, status=$5 WHERE id=$6 RETURNING *',
      [name, location, frequency, description, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Monitoring point not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update monitoring point:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/monitoring/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM monitoring_points WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete monitoring point:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Parameters ---
app.post('/api/parameters', async (req, res) => {
  const { name, monitoringPointId, instrument, unit, frequency, description } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO parameters (id, name, monitoring_point_id, instrument, unit, frequency, description) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, name, monitoringPointId || null, instrument, unit, frequency, description]
    );
    res.json({ id, name, monitoringPointId, instrument, unit, frequency, description });
  } catch (err) {
    console.error('Failed to create parameter:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/parameters/:id', async (req, res) => {
  const { name, monitoringPointId, instrument, unit, frequency, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE parameters SET name=$1, monitoring_point_id=$2, instrument=$3, unit=$4, frequency=$5, description=$6 WHERE id=$7 RETURNING *',
      [name, monitoringPointId || null, instrument, unit, frequency, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Parameter not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update parameter:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/parameters/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM parameters WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete parameter:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Checkout Conditions ---
app.post('/api/conditions', async (req, res) => {
  const { parameter, monitoringPointId, acceptance, warning, critical, action } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO checkout_conditions (id, parameter, monitoring_point_id, acceptance, warning, critical, action) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, parameter, monitoringPointId || null, acceptance, warning, critical, action]
    );
    res.json({ id, parameter, monitoringPointId, acceptance, warning, critical, action });
  } catch (err) {
    console.error('Failed to create condition:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/conditions/:id', async (req, res) => {
  const { parameter, monitoringPointId, acceptance, warning, critical, action } = req.body;
  try {
    const result = await pool.query(
      'UPDATE checkout_conditions SET parameter=$1, monitoring_point_id=$2, acceptance=$3, warning=$4, critical=$5, action=$6 WHERE id=$7 RETURNING *',
      [parameter, monitoringPointId || null, acceptance, warning, critical, action, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Condition not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update condition:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/conditions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM checkout_conditions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete condition:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Regulatory Rules ---
app.post('/api/rules', async (req, res) => {
  const { name, description, status } = req.body;
  const id = generateId();
  try {
    await pool.query(
      'INSERT INTO regulatory_rules (id, name, description, status) VALUES ($1,$2,$3,$4)',
      [id, name, description, status || 'Active']
    );
    res.json({ id, name, description, status: status || 'Active' });
  } catch (err) {
    console.error('Failed to create rule:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.put('/api/rules/:id', async (req, res) => {
  const { name, description, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE regulatory_rules SET name=$1, description=$2, status=$3 WHERE id=$4 RETURNING *',
      [name, description, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update rule:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.delete('/api/rules/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM regulatory_rules WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete rule:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// --- Manual analytical data entry (CSV upload or single manual entry) ---
app.post('/api/analytical', async (req, res) => {
  const { parameter, instrument, value, unit, timestamp, monitoringPointId } = req.body;

  if (!parameter || value === undefined) {
    return res.status(400).json({ error: 'parameter and value are required.' });
  }

  const id = generateId();
  try {
    await pool.query(
      `INSERT INTO analytical_data (id, monitoring_point_id, reading_type, parameter, value, unit, device_timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, monitoringPointId || null, 'manual', parameter, String(value), unit || null, timestamp || null]
    );
    res.json({ id, parameter, instrument, value, unit, timestamp });
  } catch (err) {
    console.error('Failed to save manual analytical entry:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});
app.use('/api', sensorRoutes(pool, generateId));
app.use('/api', complianceRoutes(pool, generateId));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Spectroscopic Intelligence backend running on port ${PORT} (PostgreSQL/Supabase)`);
});
