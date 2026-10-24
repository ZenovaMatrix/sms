"use strict";

const { verifyToken } = require("../utils/jwt");

/**
 * auth.middleware.js
 *
 * authenticate — JWT Authentication Middleware
 *
 * Extracts and verifies the JWT from the Authorization header.
 * On success:  attaches decoded claims to req.user and calls next().
 * On failure:  calls next(error) with statusCode 401.
 *
 * Expected header format:
 *   Authorization: Bearer <token>
 *
 * req.user shape after verification:
 *   { userId: string, role: string, iat: number, exp: number }
 *
 * Security notes:
 *   - Tokens are verified against JWT_SECRET from environment.
 *   - Expired tokens are rejected with 401.
 *   - Missing tokens are rejected with 401.
 *   - Token value is never logged.
 */

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];

    // Header must exist and start with "Bearer "
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const error = new Error("Authentication token is required.");
      error.statusCode = 401;
      return next(error);
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (!token) {
      const error = new Error("Authentication token is required.");
      error.statusCode = 401;
      return next(error);
    }

    // verifyToken throws with statusCode 401 on failure
    const decoded = verifyToken(token);

    // Attach safe decoded payload to request context
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    // Ensure statusCode is propagated
    if (!error.statusCode) {
      error.statusCode = 401;
    }
    return next(error);
  }
}

module.exports = { authenticate };
