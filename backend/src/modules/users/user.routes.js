"use strict";

const express = require("express");
const userController = require("./user.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

/**
 * user.routes.js
 *
 * Router for /api/v1/users
 */

// GET /api/v1/users
router.get("/", userController.getAllUsers);

// GET /api/v1/users/email/:email (placed before /:id so 'email' prefix matches first)
router.get("/email/:email", userController.getUserByEmail);

// GET /api/v1/users/:id
router.get("/:id", userController.getUserById);

// POST /api/v1/users (Admin-only user creation)
router.post("/", authenticate, authorize("admin"), userController.createUser);

// PATCH /api/v1/users/:id
router.patch("/:id", userController.updateUser);

// DELETE /api/v1/users/:id (Disabled in Phase 3A -> 501)
router.delete("/:id", userController.deleteUser);

module.exports = router;
