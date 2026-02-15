import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URI,
  ssl: true
});

try {
  const res = await pool.query('SELECT version()');
  console.log('✅ Connection successful!');
  console.log('PostgreSQL version:', res.rows[0].version.substring(0, 40));
} catch (err) {
  console.error('❌ Connection failed:', err.message);
} finally {
  await pool.end();
}
