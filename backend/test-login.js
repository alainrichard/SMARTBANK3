/**
 * Run this from the backend folder:
 * node test-login.js
 * 
 * This tests the login directly against your database.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'smartbank_db',
  user:     process.env.DB_USER     || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
});

async function run() {
  console.log('\n=== SmartBank Login Diagnostic ===\n');
  console.log('DB config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ? '(set)' : '(MISSING)',
  });

  try {
    // 1. Test DB connection
    await pool.query('SELECT 1');
    console.log('\n✓ Database connected\n');

    // 2. Check users exist
    const { rows } = await pool.query('SELECT email, password_hash, status, role FROM users ORDER BY role');
    console.log(`✓ Users in database: ${rows.length}`);

    if (rows.length === 0) {
      console.log('\n✗ NO USERS FOUND - you must run the schema:');
      console.log('  psql -U postgres -d smartbank_db -f database/schema.sql\n');
      process.exit(1);
    }

    rows.forEach(u => console.log(`  - ${u.email} | ${u.role} | ${u.status}`));

    // 3. Test each password
    console.log('\n--- Password Verification ---');
    const tests = [
      { email: 'admin@smartbank.rw',    password: 'Admin@123456' },
      { email: 'jean@example.com',       password: 'Staff@123456' },
      { email: 'manager@smartbank.rw',   password: 'Staff@123456' },
    ];

    for (const test of tests) {
      const user = rows.find(r => r.email === test.email);
      if (!user) {
        console.log(`  ✗ ${test.email}: USER NOT FOUND IN DB`);
        continue;
      }
      const match = await bcrypt.compare(test.password, user.password_hash);
      console.log(`  ${match ? '✓' : '✗'} ${test.email}: ${match ? 'PASSWORD OK' : 'PASSWORD WRONG'}`);
      if (!match) {
        console.log(`    Hash: ${user.password_hash.slice(0,30)}...`);
        // Try to identify what password is set
        for (const pw of ['Staff@123456','Admin@123456','__PENDING__','password','123456']) {
          const m = await bcrypt.compare(pw, user.password_hash).catch(() => false);
          if (m) { console.log(`    Actual password appears to be: "${pw}"`); break; }
        }
      }
    }

    // 4. Check for __PENDING__ hashes
    const pending = rows.filter(r => r.password_hash === '__PENDING__');
    if (pending.length > 0) {
      console.log(`\n✗ ${pending.length} user(s) have __PENDING__ password - they cannot log in:`);
      pending.forEach(u => console.log(`  - ${u.email}`));
      console.log('\nFix: Re-run schema.sql to reset passwords');
    }

  } catch (e) {
    console.error('\n✗ DATABASE ERROR:', e.message);
    if (e.message.includes('ECONNREFUSED')) {
      console.log('  Fix: Start PostgreSQL service');
    } else if (e.message.includes('password') || e.message.includes('SCRAM')) {
      console.log('  Fix: Check DB_PASSWORD in backend/.env - current value:', process.env.DB_PASSWORD);
    } else if (e.message.includes('does not exist')) {
      console.log('  Fix: Create database and run schema:');
      console.log('    psql -U postgres -c "CREATE DATABASE smartbank_db;"');
      console.log('    psql -U postgres -d smartbank_db -f database/schema.sql');
    }
  }

  console.log('\n================================\n');
  process.exit(0);
}

run();
