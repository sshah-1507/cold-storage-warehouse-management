const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// NFR-3: Review audit logs - Proposed access: ADMIN, MANAGER
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER'), auditController.getAuditLogs);

module.exports = router;
