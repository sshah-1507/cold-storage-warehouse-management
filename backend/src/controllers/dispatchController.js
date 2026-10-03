const { randomUUID } = require('crypto');
const { pool } = require('../config/db');
const { createDispatchSchema, createDispatchOverrideSchema } = require('../validators/warehouse');

/**
 * Helper to record audit log inside a transaction
 */
async function recordAuditLog(client, { action, entityId, oldValue, newValue, reason, userId, ipAddress }) {
  const auditId = `audit_${randomUUID()}`;
  await client.query(
    `INSERT INTO "AuditLog" (id, action, "entityId", "oldValue", "newValue", reason, "userId", "ipAddress", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      auditId,
      action,
      entityId,
      typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue,
      typeof newValue === 'object' ? JSON.stringify(newValue) : newValue,
      reason,
      userId,
      ipAddress,
    ]
  );
  return auditId;
}

/**
 * POST /api/dispatches
 * Dispatch approved request using FIFO (US-05)
 * Proposed access: A, M, St (ADMIN, MANAGER, STAFF)
 * Request: {"withdrawalId":"wr_1"}
 * Response:
 * {"data":{"id":"dispatch_1","withdrawalId":"wr_1","quantity":20,"batchAllocations":[{"batchId":"batch_1","quantity":20}],"status":"COMPLETED"}}
 */
async function createDispatch(req, res, next) {
  const client = await pool.connect();
  try {
    const parseResult = createDispatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid dispatch data',
        },
      });
    }

    const { withdrawalId } = parseResult.data;

    await client.query('BEGIN');

    // Lock withdrawal record
    const wrResult = await client.query(
      'SELECT id, "buyerId", "productName", quantity, unit, status FROM "Withdrawal" WHERE id = $1 FOR UPDATE',
      [withdrawalId]
    );

    if (wrResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Withdrawal with ID '${withdrawalId}' not found`,
        },
      });
    }

    const withdrawal = wrResult.rows[0];

    // Must be in APPROVED status
    if (withdrawal.status !== 'APPROVED') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot dispatch withdrawal with status '${withdrawal.status}'. Withdrawal must be APPROVED.`,
        },
      });
    }

    // Select eligible batches in strict FIFO order:
    // 1) Matching product name (case-insensitive)
    // 2) Has remaining stock > 0
    // 3) Ordered by receivedAt ASC, then createdAt ASC
    // Lock batches with FOR UPDATE to prevent race conditions
    const batchesResult = await client.query(
      `SELECT id, "productName", "supplierId", quantity, "remainingQuantity", unit, "receivedAt", "expiryDate", status, "chamberId"
       FROM "Batch"
       WHERE LOWER("productName") = LOWER($1) AND "remainingQuantity" > 0
       ORDER BY "receivedAt" ASC, "createdAt" ASC
       FOR UPDATE`,
      [withdrawal.productName]
    );

    const eligibleBatches = batchesResult.rows;
    const totalAvailable = eligibleBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);

    if (totalAvailable < withdrawal.quantity) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock for product '${withdrawal.productName}'. Required: ${withdrawal.quantity}, Available: ${totalAvailable}`,
        },
      });
    }

    let remainingToDispatch = withdrawal.quantity;
    const batchAllocations = [];

    for (const batch of eligibleBatches) {
      if (remainingToDispatch <= 0) break;

      const take = Math.min(batch.remainingQuantity, remainingToDispatch);
      const newRemaining = batch.remainingQuantity - take;
      const newStatus = newRemaining === 0 ? 'DISPATCHED' : 'PARTIALLY_DISPATCHED';

      // Update batch
      await client.query(
        'UPDATE "Batch" SET "remainingQuantity" = $1, status = $2, "updatedAt" = NOW() WHERE id = $3',
        [newRemaining, newStatus, batch.id]
      );

      // If batch was in a chamber, reduce chamber occupancy
      if (batch.chamberId) {
        await client.query(
          'UPDATE "Chamber" SET occupied = GREATEST(0, occupied - $1), "updatedAt" = NOW() WHERE id = $2',
          [take, batch.chamberId]
        );
      }

      batchAllocations.push({
        batchId: batch.id,
        quantity: take,
      });

      remainingToDispatch -= take;
    }

    // Create Dispatch record
    const dispatchId = `dispatch_${randomUUID()}`;
    await client.query(
      'INSERT INTO "Dispatch" (id, "withdrawalId", quantity, status, "createdAt") VALUES ($1, $2, $3, $4, NOW())',
      [dispatchId, withdrawalId, withdrawal.quantity, 'COMPLETED']
    );

    // Save batch allocations for dispatch
    for (const alloc of batchAllocations) {
      const daId = `da_${randomUUID()}`;
      await client.query(
        'INSERT INTO "DispatchAllocation" (id, "dispatchId", "batchId", quantity, "createdAt") VALUES ($1, $2, $3, $4, NOW())',
        [daId, dispatchId, alloc.batchId, alloc.quantity]
      );
    }

    // Mark withdrawal as DISPATCHED
    await client.query(
      'UPDATE "Withdrawal" SET status = $1, "updatedAt" = NOW() WHERE id = $2',
      ['DISPATCHED', withdrawalId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      data: {
        id: dispatchId,
        withdrawalId,
        quantity: withdrawal.quantity,
        batchAllocations,
        status: 'COMPLETED',
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/**
 * POST /api/dispatches/override
 * Authorized FIFO override with reason (US-05 / NFR-3)
 * Access: A, M (ADMIN, MANAGER)
 * Request: {"withdrawalId":"wr_1","batchId":"batch_2","reason":"Approved operational exception"}
 * Response:
 * {"data":{"id":"dispatch_1","withdrawalId":"wr_1","quantity":20,"batchAllocations":[{"batchId":"batch_2","quantity":20}],"status":"COMPLETED"}}
 */
async function createDispatchOverride(req, res, next) {
  const client = await pool.connect();
  try {
    const parseResult = createDispatchOverrideSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid override dispatch data',
        },
      });
    }

    const { withdrawalId, batchId, reason } = parseResult.data;
    const user = req.session.user;
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    await client.query('BEGIN');

    // Lock withdrawal record
    const wrResult = await client.query(
      'SELECT id, "buyerId", "productName", quantity, unit, status FROM "Withdrawal" WHERE id = $1 FOR UPDATE',
      [withdrawalId]
    );

    if (wrResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Withdrawal with ID '${withdrawalId}' not found`,
        },
      });
    }

    const withdrawal = wrResult.rows[0];

    if (withdrawal.status !== 'APPROVED') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot dispatch withdrawal with status '${withdrawal.status}'. Withdrawal must be APPROVED.`,
        },
      });
    }

    // Determine what strict FIFO would have selected
    const fifoCandidatesResult = await client.query(
      `SELECT id, "productName", "remainingQuantity", "receivedAt", "createdAt"
       FROM "Batch"
       WHERE LOWER("productName") = LOWER($1) AND "remainingQuantity" > 0
       ORDER BY "receivedAt" ASC, "createdAt" ASC
       FOR UPDATE`,
      [withdrawal.productName]
    );

    const defaultFifoBatch = fifoCandidatesResult.rows[0];

    // Lock selected override batch
    const batchResult = await client.query(
      'SELECT id, "productName", quantity, "remainingQuantity", unit, "chamberId", status FROM "Batch" WHERE id = $1 FOR UPDATE',
      [batchId]
    );

    if (batchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Target batch with ID '${batchId}' not found`,
        },
      });
    }

    const batch = batchResult.rows[0];

    if (batch.productName.toLowerCase() !== withdrawal.productName.toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          code: 'PRODUCT_MISMATCH',
          message: `Batch product '${batch.productName}' does not match requested product '${withdrawal.productName}'`,
        },
      });
    }

    if (batch.remainingQuantity < withdrawal.quantity) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Batch '${batchId}' has insufficient quantity (${batch.remainingQuantity}) for requested quantity (${withdrawal.quantity})`,
        },
      });
    }

    // Deduct stock from the manually specified batch
    const newRemaining = batch.remainingQuantity - withdrawal.quantity;
    const newStatus = newRemaining === 0 ? 'DISPATCHED' : 'PARTIALLY_DISPATCHED';

    await client.query(
      'UPDATE "Batch" SET "remainingQuantity" = $1, status = $2, "updatedAt" = NOW() WHERE id = $3',
      [newRemaining, newStatus, batch.id]
    );

    // If batch was in a chamber, reduce chamber occupancy
    if (batch.chamberId) {
      await client.query(
        'UPDATE "Chamber" SET occupied = GREATEST(0, occupied - $1), "updatedAt" = NOW() WHERE id = $2',
        [withdrawal.quantity, batch.chamberId]
      );
    }

    // Create Dispatch record
    const dispatchId = `dispatch_${randomUUID()}`;
    await client.query(
      'INSERT INTO "Dispatch" (id, "withdrawalId", quantity, status, "createdAt") VALUES ($1, $2, $3, $4, NOW())',
      [dispatchId, withdrawalId, withdrawal.quantity, 'COMPLETED']
    );

    // Record Dispatch Allocation
    const daId = `da_${randomUUID()}`;
    await client.query(
      'INSERT INTO "DispatchAllocation" (id, "dispatchId", "batchId", quantity, "createdAt") VALUES ($1, $2, $3, $4, NOW())',
      [daId, dispatchId, batchId, withdrawal.quantity]
    );

    // Record Audit Log in same transaction (NFR-3)
    const oldValue = {
      defaultFifoBatchId: defaultFifoBatch ? defaultFifoBatch.id : null,
      mode: 'FIFO_SELECTION',
    };
    const newValue = {
      selectedBatchId: batchId,
      quantity: withdrawal.quantity,
      mode: 'MANUAL_OVERRIDE',
    };

    await recordAuditLog(client, {
      action: 'FIFO_OVERRIDE',
      entityId: dispatchId,
      oldValue,
      newValue,
      reason,
      userId: user.id,
      ipAddress,
    });

    // Mark withdrawal as DISPATCHED
    await client.query(
      'UPDATE "Withdrawal" SET status = $1, "updatedAt" = NOW() WHERE id = $2',
      ['DISPATCHED', withdrawalId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      data: {
        id: dispatchId,
        withdrawalId,
        quantity: withdrawal.quantity,
        batchAllocations: [{ batchId, quantity: withdrawal.quantity }],
        status: 'COMPLETED',
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

/**
 * GET /api/dispatches
 * List all dispatches with withdrawal information and batch allocations
 * Access: ADMIN, MANAGER, STAFF, BUYER (buyers see only their withdrawals' dispatches)
 */
async function getDispatches(req, res, next) {
  try {
    const user = req.session.user;
    const { page, limit } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (user.role === 'BUYER') {
      conditions.push(`w."buyerId" = $${paramIndex++}`);
      params.push(user.id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM "Dispatch" d
      JOIN "Withdrawal" w ON d."withdrawalId" = w.id
      ${whereClause}
    `;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const dataSql = `
      SELECT d.id, d."withdrawalId", d.quantity, d.status, d."createdAt",
             w."productName", w."buyerId", w.unit
      FROM "Dispatch" d
      JOIN "Withdrawal" w ON d."withdrawalId" = w.id
      ${whereClause}
      ORDER BY d."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await pool.query(dataSql, [...params, limitNum, offset]);

    // For each dispatch, fetch allocated batches
    const dispatches = [];
    for (const row of dataResult.rows) {
      const allocsResult = await pool.query(
        `SELECT da."batchId", da.quantity
         FROM "DispatchAllocation" da
         WHERE da."dispatchId" = $1`,
        [row.id]
      );
      dispatches.push({
        id: row.id,
        withdrawalId: row.withdrawalId,
        productName: row.productName,
        quantity: row.quantity,
        unit: row.unit,
        buyerId: row.buyerId,
        status: row.status,
        createdAt: row.createdAt,
        batchAllocations: allocsResult.rows,
        batches: allocsResult.rows.map(a => `${a.batchId} (${a.quantity}${row.unit || 'kg'})`).join(', ') || 'N/A'
      });
    }

    return res.status(200).json({
      data: dispatches,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createDispatch,
  createDispatchOverride,
  getDispatches,
};

