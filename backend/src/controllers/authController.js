const bcrypt = require('bcrypt');
const { db } = require('../config/db');
const { loginSchema } = require('../validators/auth');

/**
 * POST /api/auth/login
 * Contract:
 * Request: { "email": "...", "password": "..." }
 * Response 200: { "data": { "id": "u_1", "name": "Demo Manager", "email": "manager@example.com", "role": "MANAGER" } }
 */
async function login(req, res, next) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid request data',
        },
      });
    }

    const { email, password } = parseResult.data;

    // Query user by email using Prisma ORM
    const user = await db.orm.public.User
      .where({ email: email.toLowerCase() })
      .first();

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Regenerate session to prevent session fixation and store user info
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        return res.status(200).json({
          data: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      });
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Contract:
 * Response 200: { "data": { "id": "...", "name": "...", "email": "...", "role": "..." } }
 */
async function getMe(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'No active session',
      },
    });
  }

  return res.status(200).json({
    data: {
      id: req.session.user.id,
      name: req.session.user.name,
      email: req.session.user.email,
      role: req.session.user.role,
    },
  });
}

/**
 * POST /api/auth/logout
 * Destroys the session and clears the session cookie
 */
async function logout(req, res, next) {
  if (!req.session) {
    return res.status(200).json({
      data: {
        message: 'Logged out successfully',
      },
    });
  }

  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }

    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    return res.status(200).json({
      data: {
        message: 'Logged out successfully',
      },
    });
  });
}

module.exports = {
  login,
  getMe,
  logout,
};
