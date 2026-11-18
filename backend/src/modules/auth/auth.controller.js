"use strict";

const authService = require("./auth.service");

/**
 * auth.controller.js
 *
 * HTTP controller for Authentication module.
 * Reads req.body / req.user, calls authService, formats JSON response.
 *
 * Handlers:
 *   login          — POST /api/v1/auth/login       (public)
 *   verifyOtp      — POST /api/v1/auth/verify-otp  (public)
 *   resendOtp      — POST /api/v1/auth/resend-otp  (public)
 *   register       — POST /api/v1/auth/register    (public)
 *   me             — GET  /api/v1/auth/me          (authenticate required)
 *   testAdmin      — GET  /api/v1/auth/test/admin  (admin only)
 *   testTeacher    — GET  /api/v1/auth/test/teacher (teacher only)
 *   testLibrarian  — GET  /api/v1/auth/test/librarian (admin | librarian)
 */

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    const message = result.requiresOtp
      ? "Verification code sent to registered admin email."
      : "Login successful";

    return res.status(200).json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const result = await authService.verifyAdminOtp(req.body);
    return res.status(200).json({
      success: true,
      message: "Admin OTP verified successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function resendOtp(req, res, next) {
  try {
    const result = await authService.resendAdminOtp(req.body);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json({
      success: true,
      message: "Registration successful. Welcome to EduManage!",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/auth/me
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
  verifyOtp,
  resendOtp,
  register,
  me,
  testAdmin,
  testTeacher,
  testLibrarian,
};
