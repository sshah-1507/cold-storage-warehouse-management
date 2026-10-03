const { pool } = require('../config/db');

/**
 * GET /api/audit-logs
 * Review payment and FIFO override changes (NFR-3)
 * Access: ADMIN, MANAGER
 */
async function getAuditLogs(req, res, next) {
  try {
    const { action, entityId, page, limit } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (action) {
      conditions.push(`a.action = $${paramIndex++}`);
      params.push(action.toUpperCase());
    }

    if (entityId) {
      conditions.push(`a."entityId" = $${paramIndex++}`);
      params.push(entityId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM "AuditLog" a ${whereClause}`;
    const countResult = await pool.query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const dataSql = `
      SELECT a.id, a.action, a."entityId", a."oldValue", a."newValue", a.reason, a."userId", a."ipAddress", a."createdAt", u.name as "actorName", u.email as "actorEmail"
      FROM "AuditLog" a
      LEFT JOIN "User" u ON a."userId" = u.id
      ${whereClause}
      ORDER BY a."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataResult = await pool.query(dataSql, [...params, limitNum, offset]);

    const formatted = dataResult.rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityId: row.entityId,
      oldValue: typeof row.oldValue === 'string' ? JSON.parse(row.oldValue || '{}') : row.oldValue,
      newValue: typeof row.newValue === 'string' ? JSON.parse(row.newValue || '{}') : row.newValue,
      reason: row.reason,
      userId: row.userId,
      actorName: row.actorName,
      actorEmail: row.actorEmail,
      ipAddress: row.ipAddress,
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

module.exports = {
  getAuditLogs,
};
