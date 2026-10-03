const { pool } = require('../config/db');

/**
 * GET /api/alerts
 * List expiry alerts (US-04)
 * Proposed access: ADMIN, MANAGER, STAFF; scoped SUPPLIER
 * Response:
 * {"data":[{"id":"alert_1","batchId":"batch_1","type":"NEAR_EXPIRY","message":"Batch batch_1 is near expiry","createdAt":"2026-09-25T09:00:00Z","deliveryStatus":"SENT"}]}
 */
async function getAlerts(req, res, next) {
  try {
    const user = req.session.user;
    const { type, deliveryStatus, page, limit } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Supplier ownership scoping (contract rule: suppliers see only alerts for their batches)
    if (user.role === 'SUPPLIER') {
      conditions.push(`b."supplierId" = $${paramIndex++}`);
      params.push(user.id);
    }

    if (type) {
      conditions.push(`a.type = $${paramIndex++}`);
      params.push(type.toUpperCase());
    }

    if (deliveryStatus) {
      conditions.push(`a."deliveryStatus" = $${paramIndex++}`);
      params.push(deliveryStatus.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM "Alert" a
      JOIN "Batch" b ON a."batchId" = b.id
      ${whereClause}
    `;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const dataSql = `
      SELECT a.id, a."batchId", a.type, a.message, a."deliveryStatus", a.attempts, a."lastAttemptAt", a."createdAt"
      FROM "Alert" a
      JOIN "Batch" b ON a."batchId" = b.id
      ${whereClause}
      ORDER BY a."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await pool.query(dataSql, [...params, limitNum, offset]);

    const formatted = dataResult.rows.map((row) => ({
      id: row.id,
      batchId: row.batchId,
      type: row.type,
      message: row.message,
      createdAt: row.createdAt,
      deliveryStatus: row.deliveryStatus,
      attempts: row.attempts,
      lastAttemptAt: row.lastAttemptAt,
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

module.exports = {
  getAlerts,
};
