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
 *   POST /login                — Authenticate and receive JWT
 *
 * Protected routes (require valid JWT via authenticate middleware):
 *   GET  /me                   — Return own identity from token claims
 *   GET  /test/admin           — Admin-only smoke test
 *   GET  /test/teacher         — Teacher-only smoke test
 *   GET  /test/librarian         — Admin or librarian smoke test
 */

// POST /api/v1/auth/login  — public
router.post("/login", authController.login);

// GET /api/v1/auth/me  — any authenticated user
router.get("/me", authenticate, authController.me);

// GET /api/v1/auth/test/admin  — admin only
router.get("/test/admin", authenticate, authorize("admin"), authController.testAdmin);

// GET /api/v1/auth/test/teacher  — teacher only
router.get("/test/teacher", authenticate, authorize("teacher"), authController.testTeacher);

// GET /api/v1/auth/test/librarian  — admin or librarian
router.get("/test/librarian", authenticate, authorize("admin", "librarian"), authController.testLibrarian);

module.exports = router;
