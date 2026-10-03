const { db, pool } = require('../config/db');
const { createWithdrawalSchema, updateWithdrawalStatusSchema } = require('../validators/warehouse');

/**
 * POST /api/withdrawals
 * Request withdrawal (US-06)
 * Access: BUYER, ADMIN, MANAGER
 * Request:
 * {"productName":"Apples","quantity":20,"unit":"kg","notes":"Customer order"}
 * Response:
 * {"data":{"id":"wr_1","buyerId":"u_5","productName":"Apples","quantity":20,"unit":"kg","status":"PENDING"}}
 */
async function createWithdrawal(req, res, next) {
  try {
    const parseResult = createWithdrawalSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid withdrawal request',
        },
      });
    }

    const { productName, quantity, unit, notes } = parseResult.data;
    const buyerId = req.session.user.id;

    // Check if there is enough total stock in warehouse to fulfill this request
    const stockResult = await pool.query(
      `SELECT COALESCE(SUM("remainingQuantity"), 0) AS total
       FROM "Batch"
       WHERE LOWER("productName") = LOWER($1) AND "remainingQuantity" > 0`,
      [productName]
    );

    const availableStock = parseInt(stockResult.rows[0].total, 10);
    if (availableStock < quantity) {
      return res.status(409).json({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock for product '${productName}'. Available: ${availableStock}, Requested: ${quantity}`,
        },
      });
    }

    const newWithdrawal = await db.orm.public.Withdrawal.create({
      buyerId,
      productName,
      quantity,
      unit,
      notes: notes || null,
      status: 'PENDING',
    });

    return res.status(201).json({
      data: {
        id: newWithdrawal.id,
        buyerId: newWithdrawal.buyerId,
        productName: newWithdrawal.productName,
        quantity: newWithdrawal.quantity,
        unit: newWithdrawal.unit,
        status: newWithdrawal.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/withdrawals
 * View withdrawal requests (US-06)
 * Access: ADMIN, MANAGER, STAFF; scoped BUYER
 */
async function getWithdrawals(req, res, next) {
  try {
    const user = req.session.user;
    const { status, page, limit } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Buyer scoping (contract rule: backend enforces from session)
    if (user.role === 'BUYER') {
      conditions.push(`"buyerId" = $${paramIndex++}`);
      params.push(user.id);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM "Withdrawal" ${whereClause}`;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const queryParams = [...params, limitNum, offset];
    const dataSql = `
      SELECT id, "buyerId", "productName", quantity, unit, notes, status, "createdAt"
      FROM "Withdrawal"
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await pool.query(dataSql, queryParams);

    const formatted = dataResult.rows.map((row) => ({
      id: row.id,
      buyerId: row.buyerId,
      productName: row.productName,
      quantity: row.quantity,
      unit: row.unit,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt,
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
 * PATCH /api/withdrawals/:id/status
 * Approve/reject request (US-06)
 * Access: ADMIN, MANAGER
 * Request: {"status":"APPROVED"}
 */
async function updateWithdrawalStatus(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const parseResult = updateWithdrawalStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid status update',
        },
      });
    }

    const { status } = parseResult.data;

    await client.query('BEGIN');

    const withdrawalResult = await client.query(
      'SELECT id, "buyerId", "productName", quantity, unit, status FROM "Withdrawal" WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (withdrawalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Withdrawal request with ID '${id}' not found`,
        },
      });
    }

    const withdrawal = withdrawalResult.rows[0];

    // Status transition validation
    if (withdrawal.status === 'DISPATCHED') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Cannot change status of an already dispatched withdrawal',
        },
      });
    }

    if (withdrawal.status === 'REJECTED' && status === 'APPROVED') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Cannot approve an already rejected withdrawal',
        },
      });
    }

    await client.query(
      'UPDATE "Withdrawal" SET status = $1, "updatedAt" = NOW() WHERE id = $2',
      [status, id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      data: {
        id: withdrawal.id,
        buyerId: withdrawal.buyerId,
        productName: withdrawal.productName,
        quantity: withdrawal.quantity,
        unit: withdrawal.unit,
        status,
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
  createWithdrawal,
  getWithdrawals,
  updateWithdrawalStatus,
};
