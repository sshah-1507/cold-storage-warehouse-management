require('dotenv').config();
const { pool } = require('./src/config/db');

async function printStatus() {
  const client = await pool.connect();
  try {
    const batches = await client.query('SELECT COUNT(*) FROM "Batch"');
    const chambers = await client.query('SELECT id, name, capacity, occupied FROM "Chamber"');
    const users = await client.query('SELECT id, email, role FROM "User"');
    const tasks = await client.query('SELECT COUNT(*) FROM "Task"');
    const dispatches = await client.query('SELECT COUNT(*) FROM "Dispatch"');
    const alerts = await client.query('SELECT COUNT(*) FROM "Alert"');
    console.log('--- DATABASE STATUS ---');
    console.log('Batches:', batches.rows[0].count);
    console.log('Tasks:', tasks.rows[0].count);
    console.log('Dispatches:', dispatches.rows[0].count);
    console.log('Alerts:', alerts.rows[0].count);
    console.log('Chambers count:', chambers.rows.length);
    console.log('Users in DB:', users.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

printStatus();
