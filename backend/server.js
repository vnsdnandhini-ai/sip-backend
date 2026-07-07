const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sensorRoutes = require('./sensorRoutes');

const complianceRoutes = require('./complianceRoutes');
const DATA_FILE = path.join(__dirname, 'data.json');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.use('/api', sensorRoutes(readData, writeData, generateId));
app.use('/api', complianceRoutes(readData, writeData, generateId));

function readData() {
  const json = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(json);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

app.get('/api/state', (req, res) => {
  res.json(readData());
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const data = readData();
  let user = data.users.find((item) => item.username === username);
  if (!user) {
    user = { id: generateId(), username, password, role: 'operator' };
    data.users.push(user);
    writeData(data);
  }

  res.json({ user: { id: user.id, username: user.username, role: user.role }, token: generateId() });
});

app.post('/api/audit', (req, res) => {
  const data = readData();
  const entry = { id: generateId(), timestamp: new Date().toLocaleString(), ...req.body };
  data.auditTrail.unshift(entry);
  writeData(data);
  res.json(entry);
});

app.post('/api/projects', (req, res) => {
  const data = readData();
  const project = { id: generateId(), ...req.body };
  data.projects.push(project);
  writeData(data);
  res.json(project);
});

app.put('/api/projects/:id', (req, res) => {
  const data = readData();
  const index = data.projects.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Project not found.' });
  data.projects[index] = { ...data.projects[index], ...req.body };
  writeData(data);
  res.json(data.projects[index]);
});

app.delete('/api/projects/:id', (req, res) => {
  const data = readData();
  data.projects = data.projects.filter((item) => item.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

app.post('/api/monitoring', (req, res) => {
  const data = readData();
  const point = { id: generateId(), ...req.body };
  data.monitoringPoints.push(point);
  writeData(data);
  res.json(point);
});

app.put('/api/monitoring/:id', (req, res) => {
  const data = readData();
  const index = data.monitoringPoints.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Monitoring point not found.' });
  data.monitoringPoints[index] = { ...data.monitoringPoints[index], ...req.body };
  writeData(data);
  res.json(data.monitoringPoints[index]);
});

app.delete('/api/monitoring/:id', (req, res) => {
  const data = readData();
  data.monitoringPoints = data.monitoringPoints.filter((item) => item.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

app.post('/api/parameters', (req, res) => {
  const data = readData();
  const parameter = { id: generateId(), ...req.body };
  data.parameters.push(parameter);
  writeData(data);
  res.json(parameter);
});

app.put('/api/parameters/:id', (req, res) => {
  const data = readData();
  const index = data.parameters.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Parameter not found.' });
  data.parameters[index] = { ...data.parameters[index], ...req.body };
  writeData(data);
  res.json(data.parameters[index]);
});

app.delete('/api/parameters/:id', (req, res) => {
  const data = readData();
  data.parameters = data.parameters.filter((item) => item.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

app.post('/api/conditions', (req, res) => {
  const data = readData();
  const condition = { id: generateId(), ...req.body };
  data.checkoutConditions.push(condition);
  writeData(data);
  res.json(condition);
});

app.put('/api/conditions/:id', (req, res) => {
  const data = readData();
  const index = data.checkoutConditions.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Condition not found.' });
  data.checkoutConditions[index] = { ...data.checkoutConditions[index], ...req.body };
  writeData(data);
  res.json(data.checkoutConditions[index]);
});

app.delete('/api/conditions/:id', (req, res) => {
  const data = readData();
  data.checkoutConditions = data.checkoutConditions.filter((item) => item.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

app.post('/api/rules', (req, res) => {
  const data = readData();
  const rule = { id: generateId(), ...req.body };
  data.regulatoryRules.push(rule);
  writeData(data);
  res.json(rule);
});

app.put('/api/rules/:id', (req, res) => {
  const data = readData();
  const index = data.regulatoryRules.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Rule not found.' });
  data.regulatoryRules[index] = { ...data.regulatoryRules[index], ...req.body };
  writeData(data);
  res.json(data.regulatoryRules[index]);
});

app.delete('/api/rules/:id', (req, res) => {
  const data = readData();
  data.regulatoryRules = data.regulatoryRules.filter((item) => item.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

app.post('/api/analytical', (req, res) => {
  const data = readData();
  const record = { id: generateId(), ...req.body };
  data.analyticalData.push(record);
  writeData(data);
  res.json(record);
});

app.post('/api/refresh', (req, res) => {
  const data = readData();
  data.complianceResults = req.body.complianceResults || [];
  data.reports = req.body.reports || [];
  writeData(data);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Spectroscopic Intelligence backend running on port ${PORT}`);
});
