require('dotenv').config();
const { pool } = require('./src/config/db');

async function cleanDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Cleaning operational and sample data...');
    await client.query('DELETE FROM "DispatchAllocation"');
    await client.query('DELETE FROM "Dispatch"');
    await client.query('DELETE FROM "Withdrawal"');
    await client.query('DELETE FROM "Allocation"');
    await client.query('DELETE FROM "Alert"');
    await client.query('DELETE FROM "Payment"');
    await client.query('DELETE FROM "RentCharge"');
    await client.query('DELETE FROM "Task"');
    await client.query('DELETE FROM "AuditLog"');
    await client.query('DELETE FROM "Batch"');
    // Reset chamber occupancy to 0
    await client.query('UPDATE "Chamber" SET occupied = 0');
    // Remove sample dummy users except admin
    await client.query('DELETE FROM "User" WHERE email != \'admin@example.com\'');
    await client.query('COMMIT');
    console.log('✓ Successfully cleared all sample seed data.');
    console.log('✓ Retained active Admin account (admin@example.com).');
    console.log('✓ Reset all cold storage chamber occupancies to 0.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cleanup failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanDatabase();
