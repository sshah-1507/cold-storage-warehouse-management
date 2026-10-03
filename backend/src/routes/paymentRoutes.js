const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-08: List payments - Proposed access: A, M; scoped payer
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'SUPPLIER'), financeController.getPayments);

// US-08: Record settlement - Proposed access: A, M
router.post('/', requireAuth, requireRoles('ADMIN', 'MANAGER'), financeController.recordPayment);

// US-08: Correct payment with audit log - Proposed access: A, M
router.patch('/:id', requireAuth, requireRoles('ADMIN', 'MANAGER'), financeController.updatePayment);

module.exports = router;
