/**
 * supabaseClient.js
 *
 * Supabase client for Storage operations (file uploads), separate
 * from the direct Postgres connection used for SQL queries (db.js).
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);
module.exports = supabase;
