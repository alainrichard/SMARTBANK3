const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pw = process.env.DB_PASSWORD;
if (pw === undefined) {
  console.error('\n[SmartBank] ERROR: DB_PASSWORD not set in backend/.env');
  console.error('Run: PowerShell -ExecutionPolicy Bypass -File create-env.ps1\n');
  process.exit(1);
}

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smartbank_db',
  user:     process.env.DB_USER || 'postgres',
  password: String(pw),
  max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, ssl: false,
});

pool.on('error', err => console.error('[DB Pool]', err.message));

// Try a light test query with retries so the server can start before DB is ready.
const tryConnect = async (attempts = 10, delayMs = 3000) => {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[SmartBank] Connected to DB:', process.env.DB_NAME || 'smartbank_db');
      return;
    } catch (err) {
      console.error(`[SmartBank] DB connection attempt ${i}/${attempts} failed:`, err.message);
      if (i === attempts) {
        if (err.message && (err.message.includes('password') || err.message.includes('SCRAM')))
          console.error('Fix: Check DB_PASSWORD in backend/.env\n');
        else if (err.message && err.message.includes('does not exist'))
          console.error('Fix: Run schema first: psql -U postgres -d smartbank_db -f database/schema.sql\n');
        else if (err.message && err.message.includes('ECONNREFUSED'))
          console.error('Fix: Start PostgreSQL service.\n');
        console.error('[SmartBank] Giving up connecting to DB for now.');
      } else {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
};

tryConnect();

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
