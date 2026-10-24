"use strict";

const authService = require("./auth.service");

/**
 * auth.controller.js
 *
 * HTTP controller for Authentication module.
 * Reads req.body / req.user, calls authService, formats JSON response.
 *
 * Handlers:
 *   login        — POST /api/v1/auth/login       (public)
 *   me           — GET  /api/v1/auth/me           (authenticate required)
 *   testAdmin    — GET  /api/v1/auth/test/admin   (admin only)
 *   testTeacher  — GET  /api/v1/auth/test/teacher (teacher only)
 *   testLibrarian — GET  /api/v1/auth/test/librarian (admin | librarian)
 */

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's identity from the verified JWT claims.
 * The authenticate middleware has already validated the token and populated
 * req.user = { userId, role }.
 */
function me(req, res) {
  return res.status(200).json({
    success: true,
    message: "Authenticated user identity",
    data: {
      userId: req.user.userId,
      role: req.user.role,
    },
  });
}

/**
 * GET /api/v1/auth/test/admin
 * Smoke-test endpoint — accessible only to role: admin.
 */
function testAdmin(req, res) {
  return res.status(200).json({
    success: true,
    message: "Admin access confirmed.",
    data: { role: req.user.role },
  });
}

/**
 * GET /api/v1/auth/test/teacher
 * Smoke-test endpoint — accessible only to role: teacher.
 */
function testTeacher(req, res) {
  return res.status(200).json({
    success: true,
    message: "Teacher access confirmed.",
    data: { role: req.user.role },
  });
}

/**
 * GET /api/v1/auth/test/librarian
 * Smoke-test endpoint — accessible to role: admin or librarian.
 */
function testLibrarian(req, res) {
  return res.status(200).json({
    success: true,
    message: "Librarian access confirmed.",
    data: { role: req.user.role },
  });
}

module.exports = {
  login,
  me,
  testAdmin,
  testTeacher,
  testLibrarian,
};
