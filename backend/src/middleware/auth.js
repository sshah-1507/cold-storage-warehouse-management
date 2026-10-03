/**
 * Ensures user is authenticated via session
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Please log in.',
      },
    });
  }
  next();
}

/**
 * Ensures authenticated user has one of the allowed roles
 * Allowed role values: 'ADMIN', 'MANAGER', 'STAFF', 'SUPPLIER', 'BUYER'
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Please log in.',
        },
      });
    }

    const userRole = req.session.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. You do not have permission to access this resource.',
        },
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRoles,
};
