"use strict";

/**
 * announcement.routes.js
 *
 * Routes for /api/v1/announcements
 */

const express = require("express");
const ctrl = require("./announcement.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

// GET all announcements (filtered for requester role)
router.get(
  "/",
  authenticate,
  authorize("admin", "teacher", "student", "parent", "librarian"),
  ctrl.getAll
);

// GET announcement by ID
router.get(
  "/:id",
  authenticate,
  authorize("admin", "teacher", "student", "parent", "librarian"),
  ctrl.getById
);

// POST announcement (admin only)
router.post(
  "/",
  authenticate,
  authorize("admin"),
  ctrl.create
);

// PATCH announcement (admin only)
router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  ctrl.patch
);

// DELETE announcement (admin only)
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  ctrl.remove
);

module.exports = router;
