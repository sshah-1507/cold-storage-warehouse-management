const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-06: Request withdrawal - Proposed access: B, A, M
router.post('/', requireAuth, requireRoles('BUYER', 'ADMIN', 'MANAGER'), withdrawalController.createWithdrawal);

// US-06: View withdrawal requests - Proposed access: A, M, St; scoped B
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF', 'BUYER'), withdrawalController.getWithdrawals);

// US-06: Approve/reject request - Proposed access: A, M
router.patch('/:id/status', requireAuth, requireRoles('ADMIN', 'MANAGER'), withdrawalController.updateWithdrawalStatus);

module.exports = router;
