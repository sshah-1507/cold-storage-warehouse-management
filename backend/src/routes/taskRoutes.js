const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-09: List tasks - Proposed access: A, M; own tasks St
router.get('/', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF'), taskController.getTasks);

// US-09: Assign staff task - Proposed access: A, M
router.post('/', requireAuth, requireRoles('ADMIN', 'MANAGER'), taskController.createTask);

// US-09: Update task status - Proposed access: A, M; assigned St
router.patch('/:id', requireAuth, requireRoles('ADMIN', 'MANAGER', 'STAFF'), taskController.updateTask);

module.exports = router;
