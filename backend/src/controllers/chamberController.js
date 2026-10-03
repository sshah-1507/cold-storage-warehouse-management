const { db } = require('../config/db');

/**
 * GET /api/chambers
 * Contract:
 * View capacity and occupancy (US-03)
 * Access: A, M, St (ADMIN, MANAGER, STAFF)
 * Response:
 * { "data": [{ "id": "ch_1", "name": "Chamber A", "capacity": 1000, "occupied": 450, "unit": "kg" }] }
 */
async function getChambers(req, res, next) {
  try {
    const chambers = await db.orm.public.Chamber
      .orderBy(c => c.name.asc())
      .all();

    const formatted = chambers.map((ch) => ({
      id: ch.id,
      name: ch.name,
      capacity: ch.capacity,
      occupied: ch.occupied,
      unit: ch.unit,
    }));

    return res.status(200).json({
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getChambers,
};
