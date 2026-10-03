require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('./config/db');

async function seed() {
  console.log('--- Starting Cold Storage Warehouse Seeding ---');

  const saltRounds = 10;
  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

  // Contract roles: ADMIN, MANAGER, STAFF, SUPPLIER, BUYER
  const users = [
    {
      id: 'u_admin_1',
      name: 'Super Admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
    {
      id: 'u_manager_1',
      name: 'Demo Manager',
      email: 'manager@example.com',
      password: hashedPassword,
      role: 'MANAGER',
    },
    {
      id: 'u_staff_1',
      name: 'Warehouse Operator',
      email: 'staff@example.com',
      password: hashedPassword,
      role: 'STAFF',
    },
    {
      id: 'u_supplier_1',
      name: 'Fresh Farms Supplier',
      email: 'supplier@example.com',
      password: hashedPassword,
      role: 'SUPPLIER',
    },
    {
      id: 'u_buyer_1',
      name: 'Quick Mart Buyer',
      email: 'buyer@example.com',
      password: hashedPassword,
      role: 'BUYER',
    },
  ];

  // Clearly marked sample chamber records (US-03)
  const chambers = [
    {
      id: 'ch_1',
      name: 'Chamber A (Apples Cold Storage)',
      capacity: 1000,
      occupied: 450,
      unit: 'kg',
    },
    {
      id: 'ch_2',
      name: 'Chamber B (Deep Freeze Seafood)',
      capacity: 2000,
      occupied: 1200,
      unit: 'kg',
    },
    {
      id: 'ch_3',
      name: 'Chamber C (Dairy & Milk Storage)',
      capacity: 1500,
      occupied: 300,
      unit: 'kg',
    },
    {
      id: 'ch_4',
      name: 'Chamber D (Vegetables Humidity-Controlled)',
      capacity: 800,
      occupied: 0,
      unit: 'kg',
    },
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert Users
    for (const u of users) {
      await client.query(
        `INSERT INTO "User" (id, name, email, password, role, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (email)
         DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, role = EXCLUDED.role, "updatedAt" = NOW()`,
        [u.id, u.name, u.email, u.password, u.role]
      );
      console.log(`Seeded user: [${u.role}] ${u.email} (Password: ${defaultPassword})`);
    }

    // Upsert Chambers
    for (const ch of chambers) {
      await client.query(
        `INSERT INTO "Chamber" (id, name, capacity, occupied, unit, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (name)
         DO UPDATE SET capacity = EXCLUDED.capacity, occupied = EXCLUDED.occupied, unit = EXCLUDED.unit, "updatedAt" = NOW()`,
        [ch.id, ch.name, ch.capacity, ch.occupied, ch.unit]
      );
      console.log(`Seeded chamber: ${ch.name} (Capacity: ${ch.capacity} ${ch.unit}, Occupied: ${ch.occupied} ${ch.unit})`);
    }

    // Seed test batches (US-02)
    const batches = [
      {
        id: 'batch_seed_1',
        productName: 'Shimla Apples',
        supplierId: 'u_supplier_1',
        quantity: 450,
        remainingQuantity: 450,
        unit: 'kg',
        receivedAt: '2026-09-20',
        expiryDate: '2026-10-15',
        status: 'ALLOCATED',
        chamberId: 'ch_1',
      },
      {
        id: 'batch_seed_2',
        productName: 'Norwegian Salmon',
        supplierId: 'u_supplier_1',
        quantity: 1200,
        remainingQuantity: 1200,
        unit: 'kg',
        receivedAt: '2026-09-22',
        expiryDate: '2026-11-20',
        status: 'ALLOCATED',
        chamberId: 'ch_2',
      },
      {
        id: 'batch_seed_3',
        productName: 'Organic Whole Milk',
        supplierId: 'u_supplier_1',
        quantity: 300,
        remainingQuantity: 300,
        unit: 'kg',
        receivedAt: '2026-09-26',
        expiryDate: '2026-10-02',
        status: 'ALLOCATED',
        chamberId: 'ch_3',
      },
      {
        id: 'batch_seed_4',
        productName: 'Valencia Oranges',
        supplierId: 'u_supplier_1',
        quantity: 200,
        remainingQuantity: 200,
        unit: 'kg',
        receivedAt: '2026-09-28',
        expiryDate: '2026-10-28',
        status: 'RECEIVED',
        chamberId: null,
      },
    ];

    for (const b of batches) {
      await client.query(
        `INSERT INTO "Batch" (id, "productName", "supplierId", quantity, "remainingQuantity", unit, "receivedAt", "expiryDate", status, "chamberId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [b.id, b.productName, b.supplierId, b.quantity, b.remainingQuantity, b.unit, b.receivedAt, b.expiryDate, b.status, b.chamberId]
      );
    }

    // Seed test staff task (US-09)
    await client.query(
      `INSERT INTO "Task" (id, title, description, "assignedTo", "dueDate", status, "createdAt", "updatedAt")
       VALUES ('task_seed_1', 'Chamber A Temperature Inspection', 'Verify digital hygrometer and thermometer align with analog gauges', 'u_staff_1', '2026-09-30', 'IN_PROGRESS', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`
    );

    // Seed test rent charge (US-07)
    await client.query(
      `INSERT INTO "RentCharge" (id, "supplierId", "periodStart", "periodEnd", "amountPaise", currency, status, "createdAt", "updatedAt")
       VALUES ('rent_seed_1', 'u_supplier_1', '2026-09-01', '2026-09-30', 150000, 'INR', 'PENDING', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`
    );

    // Seed test alert (US-04)
    await client.query(
      `INSERT INTO "Alert" (id, "batchId", type, message, "deliveryStatus", attempts, "createdAt")
       VALUES ('alert_seed_1', 'batch_seed_3', 'NEAR_EXPIRY', 'Batch batch_seed_3 (Organic Whole Milk) is near expiry on 2026-10-02', 'SENT', 1, NOW())
       ON CONFLICT (id) DO NOTHING`
    );

    await client.query('COMMIT');
    console.log('--- Database seeding completed successfully! ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seed;
