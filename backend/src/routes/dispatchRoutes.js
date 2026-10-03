const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatchController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-05: List dispatches - Proposed access: A, M, St, B
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF', 'BUYER'), dispatchController.getDispatches);

// US-05: Dispatch approved request using FIFO - Proposed access: A, M, St
router.post('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF'), dispatchController.createDispatch);

// US-05: Authorized FIFO override with reason - Proposed access: A, M
router.post('/override', requireAuth, requireRoles('ADMIN', 'MANAGER'), dispatchController.createDispatchOverride);

module.exports = router;

