/**
 * supabaseClient.js
 *
 * Supabase client for Storage operations (file uploads), separate
 * from the direct Postgres connection used for SQL queries (db.js).
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // fallback to cwd

const supabaseUrl = process.env.SUPABASE_URL || 'https://givlialqbpjlfmmnnugx.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || 'dummy';

const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;
