const { pool } = require('./config/db');

async function migrateAll() {
  const client = await pool.connect();
  try {
    console.log('Running comprehensive database migration...');

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

      CREATE TABLE IF NOT EXISTS "Alert" (
        id TEXT PRIMARY KEY,
        "batchId" TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'NEAR_EXPIRY',
        message TEXT NOT NULL,
        "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
        attempts INTEGER NOT NULL DEFAULT 0,
        "lastAttemptAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "RentCharge" (
        id TEXT PRIMARY KEY,
        "supplierId" TEXT NOT NULL,
        "periodStart" TEXT NOT NULL,
        "periodEnd" TEXT NOT NULL,
        "amountPaise" INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "Payment" (
        id TEXT PRIMARY KEY,
        "rentId" TEXT NOT NULL,
        "amountPaise" INTEGER NOT NULL,
        method TEXT NOT NULL,
        reference TEXT,
        "maskedAccountNumber" TEXT,
        status TEXT NOT NULL DEFAULT 'RECORDED',
        "paidAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "Task" (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        "assignedTo" TEXT NOT NULL,
        "dueDate" TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Critical query performance indexes (NFR-1 / NFR-7)
      CREATE INDEX IF NOT EXISTS "idx_batch_supplier_status" ON "Batch" ("supplierId", status);
      CREATE INDEX IF NOT EXISTS "idx_batch_expiry" ON "Batch" ("expiryDate", "remainingQuantity");
      CREATE INDEX IF NOT EXISTS "idx_batch_product" ON "Batch" (LOWER("productName"), "receivedAt");
      CREATE INDEX IF NOT EXISTS "idx_withdrawal_buyer_status" ON "Withdrawal" ("buyerId", status);
      CREATE INDEX IF NOT EXISTS "idx_rent_supplier_status" ON "RentCharge" ("supplierId", status);
      CREATE INDEX IF NOT EXISTS "idx_payment_rent" ON "Payment" ("rentId");
      CREATE INDEX IF NOT EXISTS "idx_task_assigned_status" ON "Task" ("assignedTo", status);
      CREATE INDEX IF NOT EXISTS "idx_audit_action_entity" ON "AuditLog" (action, "entityId");
      CREATE INDEX IF NOT EXISTS "idx_alert_batch_type" ON "Alert" ("batchId", type);
    `);

    console.log('All warehouse database tables and performance indexes verified/created successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrateAll();
