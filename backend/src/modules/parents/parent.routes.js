"use strict";

const express = require("express");
const parentController = require("./parent.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

/**
 * parent.routes.js
 *
 * Routes for /api/v1/parents and student-parent relationships
 *
 * RBAC matrix:
 *   GET    /                                      — admin only
 *   GET    /user/:userId                          — admin, parent* (* own only)
 *   GET    /:parentId/students                    — admin, parent* (* own only)
 *   POST   /:parentId/students/:studentId         — admin only
 *   DELETE /:parentId/students/:studentId         — admin only (501)
 *   GET    /:id                                   — admin, parent* (* own only)
 *   PATCH  /:id                                   — admin, parent* (* own only)
 *   POST   /                                      — admin (501)
 *   DELETE /:id                                   — admin (501)
 */

// GET /api/v1/parents — list all parents (admin only)
router.get(
  "/",
  authenticate,
  authorize("admin"),
  parentController.getAllParents
);

// POST /api/v1/parents — create parent (DISABLED — 501)
router.post(
  "/",
  authenticate,
  authorize("admin"),
  parentController.createParent
);

// GET /api/v1/parents/user/:userId — find parent by linked user ID
router.get(
  "/user/:userId",
  authenticate,
  authorize("admin", "parent"),
  parentController.getParentByUserId
);

// POST /api/v1/parents/:parentId/students/:studentId — link student to parent (admin only)
router.post(
  "/:parentId/students/:studentId",
  authenticate,
  authorize("admin"),
  parentController.createRelationship
);

// DELETE /api/v1/parents/:parentId/students/:studentId — unlink (DISABLED — 501)
router.delete(
  "/:parentId/students/:studentId",
  authenticate,
  authorize("admin"),
  parentController.deleteRelationship
);

// GET /api/v1/parents/:parentId/students — get all students linked to a parent
router.get(
  "/:parentId/students",
  authenticate,
  authorize("admin", "parent"),
  parentController.getStudentsByParentId
);

// GET /api/v1/parents/:id — get parent by ID
router.get(
  "/:id",
  authenticate,
  authorize("admin", "parent"),
  parentController.getParentById
);

// PATCH /api/v1/parents/:id — update parent profile
router.patch(
  "/:id",
  authenticate,
  authorize("admin", "parent"),
  parentController.updateParent
);

// DELETE /api/v1/parents/:id — delete parent (DISABLED — 501)
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  parentController.deleteParent
);

module.exports = router;
