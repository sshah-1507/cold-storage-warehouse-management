const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-04: List expiry alerts - Proposed access: A, M, St; scoped Su
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF', 'SUPPLIER'), alertController.getAlerts);

module.exports = router;
