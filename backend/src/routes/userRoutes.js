const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRoles } = require('../middleware/auth');

// US-01: List users - Access: ADMIN
router.get('/', requireAuth, requireRoles('ADMIN'), userController.getUsers);

// US-01: Create user with role - Access: ADMIN
router.post('/', requireAuth, requireRoles('ADMIN'), userController.createUser);

module.exports = router;
