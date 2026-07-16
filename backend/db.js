/**
 * db.js
 *
 * PostgreSQL (Supabase) connection pool. Replaces file-based storage.
 * Uses the DATABASE_URL environment variable (set on Render, and in
 * a local .env file for local development).
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase connections
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
