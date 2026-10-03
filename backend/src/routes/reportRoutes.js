const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-10: Dashboard overview - Accessible to all authenticated warehouse roles
router.get('/overview', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF', 'SUPPLIER', 'BUYER'), reportController.getOverviewReport);

// US-10: Revenue chart data - Proposed access: A, M
router.get('/revenue', requireAuth, requireRoles('ADMIN', 'MANAGER'), reportController.getRevenueReport);

// US-10: Operations summary - Proposed access: A, M
router.get('/operations', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF'), reportController.getOperationsReport);

module.exports = router;
