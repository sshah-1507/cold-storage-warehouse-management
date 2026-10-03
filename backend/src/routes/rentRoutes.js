const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-07: Calculate rent estimate - Proposed access: A, M
router.post('/calculate', requireAuth, requireRoles('ADMIN', 'MANAGER'), financeController.calculateRent);

// US-07: List rent charges - Proposed access: A, M; scoped Su
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'SUPPLIER'), financeController.getRentCharges);

module.exports = router;
