const { pool } = require('../config/db');

/**
 * GET /api/reports/overview
 * Real warehouse overview metrics (US-10)
 * Access: ADMIN, MANAGER
 * Response:
 * {"data":{"totalBatches":248,"nearExpiryBatches":12,"occupancyPercent":76,"revenuePaise":48000000,"currency":"INR"}}
 */
async function getOverviewReport(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const nearExpiryCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Run parallel aggregated queries for optimum performance
    const [batchesCount, nearExpiryCount, chamberStats, revenueStats] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM "Batch"'),
      pool.query(
        'SELECT COUNT(*) AS total FROM "Batch" WHERE "remainingQuantity" > 0 AND "expiryDate" <= $1',
        [nearExpiryCutoff]
      ),
      pool.query(
        'SELECT COALESCE(SUM(capacity), 0) AS "totalCapacity", COALESCE(SUM(occupied), 0) AS "totalOccupied" FROM "Chamber"'
      ),
      pool.query(
        'SELECT COALESCE(SUM("amountPaise"), 0) AS "totalRevenue" FROM "Payment" WHERE status != \'VOID\''
      ),
    ]);

    const totalBatches = parseInt(batchesCount.rows[0].total, 10);
    const nearExpiryBatches = parseInt(nearExpiryCount.rows[0].total, 10);
    const totalCapacity = parseInt(chamberStats.rows[0].totalCapacity, 10);
    const totalOccupied = parseInt(chamberStats.rows[0].totalOccupied, 10);
    const revenuePaise = parseInt(revenueStats.rows[0].totalRevenue, 10);

    const occupancyPercent = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    return res.status(200).json({
      data: {
        totalBatches,
        nearExpiryBatches,
        occupancyPercent,
        revenuePaise,
        currency: 'INR',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/revenue?months=6
 * Monthly revenue chart data (US-10) compatible with Recharts
 * Access: ADMIN, MANAGER
 * Response:
 * {"data":[{"month":"2026-09","revenuePaise":48000000}]}
 */
async function getRevenueReport(req, res, next) {
  try {
    const months = parseInt(req.query.months, 10) > 0 ? parseInt(req.query.months, 10) : 6;

    const result = await pool.query(
      `SELECT TO_CHAR("paidAt", 'YYYY-MM') AS month,
              COALESCE(SUM("amountPaise"), 0)::BIGINT AS "revenuePaise"
       FROM "Payment"
       WHERE "paidAt" >= NOW() - ($1 || ' months')::INTERVAL AND status != 'VOID'
       GROUP BY TO_CHAR("paidAt", 'YYYY-MM')
       ORDER BY month ASC`,
      [months]
    );

    // If database has no payments yet in that window, provide current month entry with 0
    let formatted = result.rows.map((r) => ({
      month: r.month,
      revenuePaise: parseInt(r.revenuePaise, 10),
    }));

    if (formatted.length === 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      formatted = [{ month: currentMonth, revenuePaise: 0 }];
    }

    return res.status(200).json({
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/operations
 * Detailed warehouse operations report (intake vs dispatch, chamber occupancies)
 * Access: ADMIN, MANAGER
 */
async function getOperationsReport(req, res, next) {
  try {
    const [chamberOccupancy, batchStatuses, withdrawalStatuses] = await Promise.all([
      pool.query('SELECT id, name, capacity, occupied, unit, ROUND((occupied::numeric / NULLIF(capacity, 0)) * 100, 1) as "percent" FROM "Chamber" ORDER BY name ASC'),
      pool.query('SELECT status, COUNT(*) as count, COALESCE(SUM("remainingQuantity"), 0) as "totalQuantity" FROM "Batch" GROUP BY status'),
      pool.query('SELECT status, COUNT(*) as count FROM "Withdrawal" GROUP BY status'),
    ]);

    return res.status(200).json({
      data: {
        chambers: chamberOccupancy.rows,
        batchSummary: batchStatuses.rows,
        withdrawalSummary: withdrawalStatuses.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverviewReport,
  getRevenueReport,
  getOperationsReport,
};
