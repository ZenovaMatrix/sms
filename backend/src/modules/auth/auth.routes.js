"use strict";

const express = require("express");
const authController = require("./auth.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

/**
 * auth.routes.js
 *
 * Routes for /api/v1/auth
 *
 * Public routes:
 *   POST /login                — Authenticate credentials (Admin returns tempToken + triggers OTP)
 *   POST /verify-otp           — Verify Admin 6-digit OTP and receive production JWT
 *   POST /resend-otp           — Resend 6-digit OTP with 30s rate-limiting
 *   POST /register             — Public Sign Up endpoint
 *
 * Protected routes:
 *   GET  /me                   — Return own identity from token claims
 *   GET  /test/admin           — Admin-only smoke test
 *   GET  /test/teacher         — Teacher-only smoke test
 *   GET  /test/librarian       — Admin or librarian smoke test
 */

// POST /api/v1/auth/login  — public
router.post("/login", authController.login);

// POST /api/v1/auth/verify-otp  — public (requires tempToken)
router.post("/verify-otp", authController.verifyOtp);

// POST /api/v1/auth/resend-otp  — public (requires tempToken)
router.post("/resend-otp", authController.resendOtp);

// POST /api/v1/auth/demo-otp-peek  — demo only (requires tempToken + peekSecret)
router.post("/demo-otp-peek", authController.getDemoOtp);

// POST /api/v1/auth/register  — public
router.post("/register", authController.register);

// GET /api/v1/auth/me  — any authenticated user
router.get("/me", authenticate, authController.me);

// GET /api/v1/auth/test/admin  — admin only
router.get("/test/admin", authenticate, authorize("admin"), authController.testAdmin);

// GET /api/v1/auth/test/teacher  — teacher only
router.get("/test/teacher", authenticate, authorize("teacher"), authController.testTeacher);

// GET /api/v1/auth/test/librarian  — admin or librarian
router.get("/test/librarian", authenticate, authorize("admin", "librarian"), authController.testLibrarian);

module.exports = router;
