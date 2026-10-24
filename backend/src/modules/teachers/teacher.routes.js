"use strict";

const express = require("express");
const teacherController = require("./teacher.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

/**
 * teacher.routes.js
 *
 * Routes for /api/v1/teachers
 *
 * RBAC matrix:
 *   GET  /                 — admin, teacher
 *   GET  /user/:userId     — admin, teacher*   (* ownership enforced in service)
 *   GET  /:id              — admin, teacher*   (* ownership enforced in service)
 *   PATCH /:id             — admin, teacher*   (* ownership enforced in service)
 *   POST /                 — admin → 501
 *   DELETE /:id            — admin → 501
 *
 * Route ordering:
 *   /user/:userId MUST be declared before /:id to prevent Express matching
 *   the literal string "user" as a teacher UUID.
 */

// GET /api/v1/teachers — paginated list with optional search
router.get(
  "/",
  authenticate,
  authorize("admin", "teacher"),
  teacherController.getAllTeachers
);

// GET /api/v1/teachers/user/:userId — find teacher by linked user ID
router.get(
  "/user/:userId",
  authenticate,
  authorize("admin", "teacher"),
  teacherController.getTeacherByUserId
);

// GET /api/v1/teachers/:id — find teacher by teachers.id
router.get(
  "/:id",
  authenticate,
  authorize("admin", "teacher"),
  teacherController.getTeacherById
);

// PATCH /api/v1/teachers/:id — update allowed teacher fields
router.patch(
  "/:id",
  authenticate,
  authorize("admin", "teacher"),
  teacherController.updateTeacher
);

// POST /api/v1/teachers — create teacher (DISABLED — 501)
router.post(
  "/",
  authenticate,
  authorize("admin"),
  teacherController.createTeacher
);

// DELETE /api/v1/teachers/:id — delete teacher (DISABLED — 501)
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  teacherController.deleteTeacher
);

module.exports = router;
