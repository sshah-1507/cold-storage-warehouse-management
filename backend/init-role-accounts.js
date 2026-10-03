require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('./src/config/db');

async function seedRoleAccounts() {
  const client = await pool.connect();
  try {
    const saltRounds = 10;
    const defaultPassword = 'password123';
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

    const users = [
      { id: 'u_admin_1', name: 'Super Admin', email: 'admin@example.com', role: 'ADMIN' },
      { id: 'u_manager_1', name: 'Operations Manager', email: 'manager@example.com', role: 'MANAGER' },
      { id: 'u_staff_1', name: 'Warehouse Operator', email: 'staff@example.com', role: 'STAFF' },
      { id: 'u_supplier_1', name: 'Commercial Supplier', email: 'supplier@example.com', role: 'SUPPLIER' },
      { id: 'u_buyer_1', name: 'Wholesale Buyer', email: 'buyer@example.com', role: 'BUYER' },
    ];

    await client.query('BEGIN');
    for (const u of users) {
      await client.query(
        `INSERT INTO "User" (id, name, email, password, role, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (email)
         DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, role = EXCLUDED.role, "updatedAt" = NOW()`,
        [u.id, u.name, u.email, hashedPassword, u.role]
      );
      console.log(`✓ Active account ready: [${u.role}] ${u.email}`);
    }
    await client.query('COMMIT');
    console.log('All real operational role accounts are initialized with password: password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Account setup failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedRoleAccounts();
