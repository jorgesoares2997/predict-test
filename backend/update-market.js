require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('UPDATE "Market" SET liquidate_at = NOW() - INTERVAL \'1 hour\' WHERE id = \'2fbe377e-206b-4c5c-9ba6-4b3f60bf313f\'').then(res => {
  console.log('Updated market to liquidate in the past!');
  pool.end();
});
