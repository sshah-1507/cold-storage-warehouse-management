const bcrypt = require('bcrypt');
const { db, pool } = require('../config/db');
const { createUserSchema } = require('../validators/auth');

/**
 * GET /api/users
 * List all users (US-01)
 * Access: ADMIN
 */
async function getUsers(req, res, next) {
  try {
    const users = await db.orm.public.User
      .orderBy(u => u.createdAt.desc())
      .all();

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    }));

    return res.status(200).json({
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/users
 * Create user with role (US-01)
 * Access: ADMIN
 */
async function createUser(req, res, next) {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid user data',
        },
      });
    }

    const { name, email, password, role } = parseResult.data;

    // Check if email already exists
    const existing = await db.orm.public.User
      .where({ email: email.toLowerCase() })
      .first();

    if (existing) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: `User with email '${email}' already exists`,
        },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.orm.public.User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
    });

    return res.status(201).json({
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUsers,
  createUser,
};
