const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/allocationController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-03: Allocate batch to chamber - Proposed access: A, M
router.post('/', requireAuth, requireRoles('ADMIN', 'MANAGER'), allocationController.createAllocation);

module.exports = router;
