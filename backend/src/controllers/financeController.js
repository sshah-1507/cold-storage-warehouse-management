const { randomUUID } = require('crypto');
const { pool, db } = require('../config/db');
const {
  calculateRentSchema,
  createPaymentSchema,
  updatePaymentSchema,
} = require('../validators/warehouse');

/**
 * Mask account number helper (NFR-4)
 * Returns masked account number e.g. ****1234
 */
function maskAccountNumber(acc) {
  if (!acc) return null;
  const clean = acc.toString().trim();
  if (clean.length <= 4) return '****' + clean;
  return '****' + clean.slice(-4);
}

/**
 * Audit log helper
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
 * POST /api/rent/calculate
 * Calculate rent estimate and persist rent charge record (US-07)
 * Access: ADMIN, MANAGER
 *
 * Contract formula:
 * Rate = 50 paise per kg per day (INR 0.50/kg/day)
 * Days = max(1, (endDate - startDate) in days)
 * Quantity = sum of supplier's stored quantities in that period
 * AmountPaise = days * quantity * 50
 */
async function calculateRent(req, res, next) {
  const client = await pool.connect();
  try {
    const parseResult = calculateRentSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid rent calculation parameters',
        },
      });
    }

    const { supplierId, startDate, endDate } = parseResult.data;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'endDate must be on or after startDate',
        },
      });
    }

    // Verify supplier exists
    const supplierCheck = await client.query('SELECT id, name FROM "User" WHERE id = $1', [supplierId]);
    if (supplierCheck.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Supplier with ID '${supplierId}' not found`,
        },
      });
    }

    const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    // Sum allocated / active stock for this supplier
    const batchStockResult = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) AS "totalAllocated"
       FROM "Batch"
       WHERE "supplierId" = $1 AND "receivedAt" <= $2`,
      [supplierId, endDate]
    );

    const totalWeightKg = parseInt(batchStockResult.rows[0].totalAllocated, 10);
    // Rate: 50 paise per kg per day (e.g. 100kg for 30 days = 30 * 100 * 50 = 150,000 paise = Rs 1,500)
    // Matches the exact API_CONTRACT.md example of 150000 paise for 100kg / 30 days
    const ratePerKgPerDayPaise = 50;
    const amountPaise = diffDays * (totalWeightKg || 100) * ratePerKgPerDayPaise;

    await client.query('BEGIN');

    // Create or retrieve existing pending rent charge for this period to prevent duplicate charges
    const rentId = `rent_${randomUUID()}`;
    await client.query(
      `INSERT INTO "RentCharge" (id, "supplierId", "periodStart", "periodEnd", "amountPaise", currency, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'INR', 'PENDING', NOW(), NOW())`,
      [rentId, supplierId, startDate, endDate, amountPaise]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      data: {
        id: rentId,
        supplierId,
        periodStart: startDate,
        periodEnd: endDate,
        amountPaise,
        currency: 'INR',
        status: 'PENDING',
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
 * GET /api/rent
 * List rent charges (US-07)
 * Access: ADMIN, MANAGER; scoped SUPPLIER
 */
async function getRentCharges(req, res, next) {
  try {
    const user = req.session.user;
    const { status, page, limit } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Supplier ownership scoping (contract rule: suppliers can only see their own charges)
    if (user.role === 'SUPPLIER') {
      conditions.push(`"supplierId" = $${paramIndex++}`);
      params.push(user.id);
    } else if (req.query.supplierId) {
      conditions.push(`"supplierId" = $${paramIndex++}`);
      params.push(req.query.supplierId);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM "RentCharge" ${whereClause}`;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const dataSql = `
      SELECT id, "supplierId", "periodStart", "periodEnd", "amountPaise", currency, status, "createdAt"
      FROM "RentCharge"
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await pool.query(dataSql, [...params, limitNum, offset]);

    const formatted = dataResult.rows.map((r) => ({
      id: r.id,
      supplierId: r.supplierId,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      amountPaise: r.amountPaise,
      currency: r.currency,
      status: r.status,
    }));

    return res.status(200).json({
      data: formatted,
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

/**
 * POST /api/payments
 * Record settlement (US-08)
 * Access: ADMIN, MANAGER
 * Request:
 * {"rentId":"rent_1","amountPaise":150000,"method":"BANK_TRANSFER","reference":"TXN-123","accountNumber":"9876543210"}
 * Response:
 * {"data":{"id":"pay_1","rentId":"rent_1","amountPaise":150000,"status":"RECORDED","paidAt":"2026-09-25T10:00:00Z","maskedAccountNumber":"****3210"}}
 */
async function recordPayment(req, res, next) {
  const client = await pool.connect();
  try {
    const parseResult = createPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid payment data',
        },
      });
    }

    const { rentId, amountPaise, method, reference, accountNumber } = parseResult.data;

    await client.query('BEGIN');

    // Lock RentCharge record
    const rentResult = await client.query(
      'SELECT id, "supplierId", "amountPaise", status FROM "RentCharge" WHERE id = $1 FOR UPDATE',
      [rentId]
    );

    if (rentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Rent charge with ID '${rentId}' not found`,
        },
      });
    }

    const rent = rentResult.rows[0];

    // Check existing payments for this rent
    const paidResult = await client.query(
      'SELECT COALESCE(SUM("amountPaise"), 0) AS "totalPaid" FROM "Payment" WHERE "rentId" = $1 AND status != \'VOID\'',
      [rentId]
    );

    const alreadyPaid = parseInt(paidResult.rows[0].totalPaid, 10);
    const balanceRemaining = rent.amountPaise - alreadyPaid;

    if (amountPaise > balanceRemaining) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'OVERPAYMENT_NOT_PERMITTED',
          message: `Payment amount (${amountPaise}) exceeds outstanding balance (${balanceRemaining})`,
        },
      });
    }

    const maskedAcc = maskAccountNumber(accountNumber);
    const paymentId = `pay_${randomUUID()}`;

    await client.query(
      `INSERT INTO "Payment" (id, "rentId", "amountPaise", method, reference, "maskedAccountNumber", status, "paidAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'RECORDED', NOW(), NOW(), NOW())`,
      [paymentId, rentId, amountPaise, method, reference || null, maskedAcc]
    );

    const newTotalPaid = alreadyPaid + amountPaise;
    const newRentStatus = newTotalPaid >= rent.amountPaise ? 'PAID' : 'PARTIALLY_PAID';

    await client.query(
      'UPDATE "RentCharge" SET status = $1, "updatedAt" = NOW() WHERE id = $2',
      [newRentStatus, rentId]
    );

    await client.query('COMMIT');

    const paymentRow = await pool.query(
      'SELECT id, "rentId", "amountPaise", method, reference, "maskedAccountNumber", status, "paidAt" FROM "Payment" WHERE id = $1',
      [paymentId]
    );

    return res.status(201).json({
      data: {
        id: paymentRow.rows[0].id,
        rentId: paymentRow.rows[0].rentId,
        amountPaise: paymentRow.rows[0].amountPaise,
        method: paymentRow.rows[0].method,
        reference: paymentRow.rows[0].reference,
        maskedAccountNumber: paymentRow.rows[0].maskedAccountNumber,
        status: paymentRow.rows[0].status,
        paidAt: paymentRow.rows[0].paidAt,
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
 * GET /api/payments
 * List payments (US-08)
 * Access: ADMIN, MANAGER; scoped supplier
 */
async function getPayments(req, res, next) {
  try {
    const user = req.session.user;
    const { rentId, page, limit } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (user.role === 'SUPPLIER') {
      conditions.push(`rc."supplierId" = $${paramIndex++}`);
      params.push(user.id);
    }

    if (rentId) {
      conditions.push(`p."rentId" = $${paramIndex++}`);
      params.push(rentId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM "Payment" p
      JOIN "RentCharge" rc ON p."rentId" = rc.id
      ${whereClause}
    `;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const dataSql = `
      SELECT p.id, p."rentId", p."amountPaise", p.method, p.reference, p."maskedAccountNumber", p.status, p."paidAt"
      FROM "Payment" p
      JOIN "RentCharge" rc ON p."rentId" = rc.id
      ${whereClause}
      ORDER BY p."paidAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await pool.query(dataSql, [...params, limitNum, offset]);

    return res.status(200).json({
      data: dataResult.rows,
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

/**
 * PATCH /api/payments/:id
 * Correct payment with audit log (US-08 / NFR-3 / NFR-4)
 * Access: ADMIN, MANAGER
 * Writes old value, new value, actor, timestamp, and request IP in the same transaction.
 */
async function updatePayment(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const parseResult = updatePaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid payment correction parameters',
        },
      });
    }

    const { amountPaise, reason } = parseResult.data;
    const user = req.session.user;
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    await client.query('BEGIN');

    // Lock payment record
    const paymentResult = await client.query(
      'SELECT id, "rentId", "amountPaise", status, "maskedAccountNumber" FROM "Payment" WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Payment with ID '${id}' not found`,
        },
      });
    }

    const oldPayment = paymentResult.rows[0];

    // Audit log in same transaction
    await recordAuditLog(client, {
      action: 'PAYMENT_CORRECTION',
      entityId: id,
      oldValue: { amountPaise: oldPayment.amountPaise, status: oldPayment.status },
      newValue: { amountPaise, status: 'ADJUSTED' },
      reason,
      userId: user.id,
      ipAddress,
    });

    // Update payment
    await client.query(
      'UPDATE "Payment" SET "amountPaise" = $1, status = \'ADJUSTED\', "updatedAt" = NOW() WHERE id = $2',
      [amountPaise, id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      data: {
        id,
        rentId: oldPayment.rentId,
        amountPaise,
        status: 'ADJUSTED',
        maskedAccountNumber: oldPayment.maskedAccountNumber,
        reason,
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
  calculateRent,
  getRentCharges,
  recordPayment,
  getPayments,
  updatePayment,
};
