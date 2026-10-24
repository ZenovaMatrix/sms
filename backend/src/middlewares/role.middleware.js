"use strict";

/**
 * role.middleware.js
 *
 * authorize — Role-Based Access Control (RBAC) Middleware Factory
 *
 * Returns an Express middleware function that allows only requests whose
 * req.user.role matches one of the permitted roles.
 *
 * Usage:
 *   router.get('/admin-only', authenticate, authorize('admin'), handler);
 *   router.get('/staff-area', authenticate, authorize('admin', 'teacher'), handler);
 *
 * Preconditions:
 *   - Must be used AFTER the authenticate middleware so req.user is populated.
 *
 * On success:  calls next().
 * On failure:  calls next(error) with statusCode 403.
 *
 * Valid roles (mirrors the users table ENUM):
 *   admin | teacher | student | parent | librarian
 *
 * Security notes:
 *   - If req.user is missing (authenticate not called first), returns 403.
 *   - Role comparison is case-sensitive (matches database ENUM values).
 *   - No role value is ever logged.
 */

const VALID_ROLES = new Set(["admin", "teacher", "student", "parent", "librarian"]);

function authorize(...allowedRoles) {
  // Validate roles at middleware registration time (fail fast on misconfiguration)
  for (const role of allowedRoles) {
    if (!VALID_ROLES.has(role)) {
      throw new Error(
        `[authorize] Invalid role specified in route configuration: "${role}". ` +
          `Allowed roles: ${[...VALID_ROLES].join(", ")}`
      );
    }
  }

  if (allowedRoles.length === 0) {
    throw new Error("[authorize] At least one role must be specified.");
  }

  const allowedSet = new Set(allowedRoles);

  return function (req, res, next) {
    // authenticate must have run first to populate req.user
    if (!req.user || !req.user.role) {
      const error = new Error("Forbidden: access denied.");
      error.statusCode = 403;
      return next(error);
    }

    if (!allowedSet.has(req.user.role)) {
      const error = new Error("Forbidden: insufficient permissions.");
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
}

module.exports = { authorize };
