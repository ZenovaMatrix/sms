"use strict";

/**
 * academicYear.routes.js
 *
 * Routes for /api/v1/academic-years
 *
 * RBAC:
 *   GET  /       — admin, teacher, student, parent
 *   GET  /:id    — admin, teacher, student, parent
 *   POST /       — admin
 *   PATCH /:id   — admin
 *   DELETE /:id  — admin
 */

const express = require("express");
const ctrl = require("./academicYear.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get("/", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getAll);
router.get("/:id", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getById);
router.post("/", authenticate, authorize("admin"), ctrl.create);
router.patch("/:id", authenticate, authorize("admin"), ctrl.patch);
router.delete("/:id", authenticate, authorize("admin"), ctrl.remove);

module.exports = router;
