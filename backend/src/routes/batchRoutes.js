const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-02: Register incoming batch - Proposed access: A, M, St
router.post('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF'), batchController.createBatch);

// US-02: List/search stock batches - Proposed access: A, M, St; scoped Su
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF', 'SUPPLIER'), batchController.getBatches);

// US-02: Get single batch details
router.get('/:id', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF', 'SUPPLIER'), batchController.getBatchById);

module.exports = router;
