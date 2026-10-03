const { pool } = require('../config/db');
const { createAllocationSchema } = require('../validators/warehouse');

/**
 * POST /api/allocations
 * Allocate batch to chamber (US-03)
 * Access: A, M (ADMIN, MANAGER)
 * Request:
 * {"batchId":"batch_1","chamberId":"ch_1","quantity":100}
 * Response:
 * {"data":{"id":"allocation_1","batchId":"batch_1","chamberId":"ch_1","quantity":100}}
 *
 * Transactional guarantees:
 * - Locks Chamber and Batch rows with FOR UPDATE to prevent race conditions and concurrent over-allocation
 * - Verifies batch remainingQuantity >= requested quantity
 * - Verifies chamber free capacity >= requested quantity
 * - Compatible unit check
 * - Updates batch.chamberId and batch.status to 'ALLOCATED'
 * - Updates chamber.occupied += quantity
 * - Inserts Allocation record
 */
async function createAllocation(req, res, next) {
  const client = await pool.connect();
  try {
    const parseResult = createAllocationSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid allocation data',
        },
      });
    }

    const { batchId, chamberId, quantity } = parseResult.data;

    await client.query('BEGIN');

    // Lock and get Batch
    const batchResult = await client.query(
      'SELECT id, "productName", "supplierId", quantity, "remainingQuantity", unit, status, "chamberId" FROM "Batch" WHERE id = $1 FOR UPDATE',
      [batchId]
    );

    if (batchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Batch with ID '${batchId}' not found`,
        },
      });
    }

    const batch = batchResult.rows[0];

    // Check if batch is already allocated (MVP contract: One batch belongs to one chamber)
    if (batch.chamberId && batch.chamberId !== chamberId) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'BATCH_ALREADY_ALLOCATED',
          message: `Batch is already allocated to chamber '${batch.chamberId}'`,
        },
      });
    }

    if (batch.remainingQuantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'INSUFFICIENT_BATCH_QUANTITY',
          message: `Batch remaining quantity (${batch.remainingQuantity}) is less than allocation request (${quantity})`,
        },
      });
    }

    // Lock and get Chamber
    const chamberResult = await client.query(
      'SELECT id, name, capacity, occupied, unit FROM "Chamber" WHERE id = $1 FOR UPDATE',
      [chamberId]
    );

    if (chamberResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Chamber with ID '${chamberId}' not found`,
        },
      });
    }

    const chamber = chamberResult.rows[0];

    // Compatible unit check
    if (batch.unit !== chamber.unit) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: {
          code: 'UNIT_MISMATCH',
          message: `Batch unit '${batch.unit}' does not match chamber unit '${chamber.unit}'`,
        },
      });
    }

    // Capacity overflow check
    const freeCapacity = chamber.capacity - chamber.occupied;
    if (quantity > freeCapacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'CAPACITY_EXCEEDED',
          message: `Chamber capacity exceeded. Available: ${freeCapacity} ${chamber.unit}, Requested: ${quantity} ${chamber.unit}`,
        },
      });
    }

    // Generate Allocation ID
    const { randomUUID } = require('crypto');
    const allocationId = `alloc_${randomUUID()}`;

    // Insert allocation record
    await client.query(
      'INSERT INTO "Allocation" (id, "batchId", "chamberId", quantity, "createdAt") VALUES ($1, $2, $3, $4, NOW())',
      [allocationId, batchId, chamberId, quantity]
    );

    // Update chamber occupancy
    const newOccupied = chamber.occupied + quantity;
    await client.query(
      'UPDATE "Chamber" SET occupied = $1, "updatedAt" = NOW() WHERE id = $2',
      [newOccupied, chamberId]
    );

    // Update batch chamberId and status
    await client.query(
      'UPDATE "Batch" SET "chamberId" = $1, status = $2, "updatedAt" = NOW() WHERE id = $3',
      [chamberId, 'ALLOCATED', batchId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      data: {
        id: allocationId,
        batchId,
        chamberId,
        quantity,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  createAllocation,
};
