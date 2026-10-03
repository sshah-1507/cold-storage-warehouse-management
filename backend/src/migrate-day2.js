const { pool } = require('./config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Batch" (
        id TEXT PRIMARY KEY,
        "productName" TEXT NOT NULL,
        "supplierId" TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        "remainingQuantity" INTEGER NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        "receivedAt" TEXT NOT NULL,
        "expiryDate" TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'RECEIVED',
        "chamberId" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "Allocation" (
        id TEXT PRIMARY KEY,
        "batchId" TEXT NOT NULL,
        "chamberId" TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "Withdrawal" (
        id TEXT PRIMARY KEY,
        "buyerId" TEXT NOT NULL,
        "productName" TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "Dispatch" (
        id TEXT PRIMARY KEY,
        "withdrawalId" TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "DispatchAllocation" (
        id TEXT PRIMARY KEY,
        "dispatchId" TEXT NOT NULL,
        "batchId" TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "AuditLog" (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "oldValue" TEXT,
        "newValue" TEXT,
        "reason" TEXT,
        "userId" TEXT NOT NULL,
        "ipAddress" TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Day 2 tables verified/created successfully in PostgreSQL');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
