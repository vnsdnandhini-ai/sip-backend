/**
 * db.js
 *
 * PostgreSQL (Supabase) connection pool. Replaces file-based storage.
 * Uses the DATABASE_URL environment variable (set on Render, and in
 * a local .env file for local development).
 */

const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config(); // fallback to cwd

const DEFAULT_DATABASE_URL = 'postgresql://postgres.givlialqbpjlfmmnnugx:5uyQOvJrPMP2R9Ye@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase connections
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
