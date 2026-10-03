const { db, pool } = require('../config/db');
const { createBatchSchema } = require('../validators/warehouse');

/**
 * POST /api/batches
 * Register incoming batch (US-02)
 * Proposed access: ADMIN, MANAGER, STAFF
 * Request:
 * {"productName":"Apples","supplierId":"u_4","quantity":100,"unit":"kg","receivedAt":"2026-09-25","expiryDate":"2026-10-10"}
 * Response:
 * {"data":{"id":"batch_1","productName":"Apples","supplierId":"u_4","quantity":100,"remainingQuantity":100,"unit":"kg","receivedAt":"2026-09-25","expiryDate":"2026-10-10","status":"RECEIVED","chamberId":null}}
 */
async function createBatch(req, res, next) {
  try {
    const parseResult = createBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid batch data',
        },
      });
    }

    const { productName, supplierId, quantity, unit, receivedAt, expiryDate } = parseResult.data;

    // Validate supplier existence
    const supplier = await db.orm.public.User
      .where({ id: supplierId })
      .first();

    if (!supplier) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Supplier with ID '${supplierId}' not found`,
        },
      });
    }

    // Insert batch using Prisma ORM
    const newBatch = await db.orm.public.Batch.create({
      productName,
      supplierId,
      quantity,
      remainingQuantity: quantity,
      unit,
      receivedAt,
      expiryDate,
      status: 'RECEIVED',
    });

    return res.status(201).json({
      data: {
        id: newBatch.id,
        productName: newBatch.productName,
        supplierId: newBatch.supplierId,
        quantity: newBatch.quantity,
        remainingQuantity: newBatch.remainingQuantity,
        unit: newBatch.unit,
        receivedAt: newBatch.receivedAt,
        expiryDate: newBatch.expiryDate,
        status: newBatch.status,
        chamberId: newBatch.chamberId,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/batches
 * List/search stock batches (US-02)
 * Proposed access: ADMIN, MANAGER, STAFF; scoped SUPPLIER
 * Query params: search, status, page, limit
 * Scoping: Suppliers can only see their own batches based on session user ID
 */
async function getBatches(req, res, next) {
  try {
    const user = req.session.user;
    const { search, status, page, limit } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Supplier ownership scoping (contract rule: backend enforces from session)
    if (user.role === 'SUPPLIER') {
      conditions.push(`"supplierId" = $${paramIndex++}`);
      params.push(user.id);
    } else if (req.query.supplierId) {
      conditions.push(`"supplierId" = $${paramIndex++}`);
      params.push(req.query.supplierId);
    }

    // Status filter
    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status.toUpperCase());
    }

    // Search filter (productName case-insensitive search)
    if (search) {
      conditions.push(`"productName" ILIKE $${paramIndex++}`);
      params.push(`%${search.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch total count and paginated rows
    const countSql = `SELECT COUNT(*) AS total FROM "Batch" ${whereClause}`;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const queryParams = [...params, limitNum, offset];
    const dataSql = `
      SELECT id, "productName", "supplierId", quantity, "remainingQuantity", unit, "receivedAt", "expiryDate", status, "chamberId"
      FROM "Batch"
      ${whereClause}
      ORDER BY "receivedAt" ASC, "createdAt" ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await pool.query(dataSql, queryParams);

    const formatted = dataResult.rows.map((row) => ({
      id: row.id,
      productName: row.productName,
      supplierId: row.supplierId,
      quantity: row.quantity,
      remainingQuantity: row.remainingQuantity,
      unit: row.unit,
      receivedAt: row.receivedAt,
      expiryDate: row.expiryDate,
      status: row.status,
      chamberId: row.chamberId,
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
 * GET /api/batches/:id
 * Retrieve single batch by ID
 */
async function getBatchById(req, res, next) {
  try {
    const user = req.session.user;
    const { id } = req.params;

    const batch = await db.orm.public.Batch
      .where({ id })
      .first();

    if (!batch) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Batch with ID '${id}' not found`,
        },
      });
    }

    // Supplier ownership scoping check
    if (user.role === 'SUPPLIER' && batch.supplierId !== user.id) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. You do not own this batch.',
        },
      });
    }

    return res.status(200).json({
      data: {
        id: batch.id,
        productName: batch.productName,
        supplierId: batch.supplierId,
        quantity: batch.quantity,
        remainingQuantity: batch.remainingQuantity,
        unit: batch.unit,
        receivedAt: batch.receivedAt,
        expiryDate: batch.expiryDate,
        status: batch.status,
        chamberId: batch.chamberId,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBatch,
  getBatches,
  getBatchById,
};
