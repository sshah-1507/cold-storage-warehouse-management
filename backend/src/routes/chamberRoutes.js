const express = require('express');
const router = express.Router();
const chamberController = require('../controllers/chamberController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-03: View capacity and occupancy - Proposed access: A, M, St
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF'), chamberController.getChambers);

module.exports = router;
