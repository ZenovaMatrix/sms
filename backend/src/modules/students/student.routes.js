"use strict";

const express = require("express");
const studentController = require("./student.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

/**
 * student.routes.js
 *
 * Routes for /api/v1/students
 *
 * RBAC matrix:
 *   GET  /                 — admin, teacher
 *   GET  /user/:userId     — admin, teacher, student*, parent*   (* ownership enforced in service)
 *   GET  /:id              — admin, teacher, student*, parent*   (* ownership enforced in service)
 *   PATCH /:id             — admin, student*                     (* ownership enforced in service)
 *   POST /                 — admin only → 501 (disabled Phase 4A)
 *   DELETE /:id            — admin only → 501 (disabled Phase 4A)
 *
 * Route ordering:
 *   /user/:userId MUST be declared before /:id to prevent Express matching
 *   the literal string "user" as a student UUID.
 *
 * Security:
 *   - authenticate verifies JWT and populates req.user = { userId, role }
 *   - authorize() validates role at the route level
 *   - Student ownership (user_id === req.user.userId) is enforced in the service layer
 *   - Parent access is denied at service level until Phase 4C
 */

// GET /api/v1/students — paginated list with optional search
// Access: admin, teacher
router.get(
  "/",
  authenticate,
  authorize("admin", "teacher"),
  studentController.getAllStudents
);

// GET /api/v1/students/user/:userId — find student by linked user ID
// IMPORTANT: must be BEFORE /:id so "user" is not matched as a UUID
// Access: admin, teacher, student (own only), parent (denied in service — Phase 4C)
router.get(
  "/user/:userId",
  authenticate,
  authorize("admin", "teacher", "student", "parent"),
  studentController.getStudentByUserId
);

// GET /api/v1/students/:studentId/parents — find parents linked to a student
// Access: admin, teacher, student (own only), parent (linked only)
router.get(
  "/:studentId/parents",
  authenticate,
  authorize("admin", "teacher", "student", "parent"),
  studentController.getStudentParents
);

// GET /api/v1/students/:id — find student by students.id
// Access: admin, teacher, student (own only), parent (denied in service — Phase 4C)
router.get(
  "/:id",
  authenticate,
  authorize("admin", "teacher", "student", "parent"),
  studentController.getStudentById
);

// PATCH /api/v1/students/:id — update allowed student fields
// Access: admin (unrestricted), student (own record only)
router.patch(
  "/:id",
  authenticate,
  authorize("admin", "student"),
  studentController.updateStudent
);

// POST /api/v1/students — create student (DISABLED — 501)
// Access: admin only; returns 501 in Phase 4A
router.post(
  "/",
  authenticate,
  authorize("admin"),
  studentController.createStudent
);

// DELETE /api/v1/students/:id — delete student (DISABLED — 501)
// Access: admin only; returns 501 for data integrity
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  studentController.deleteStudent
);

module.exports = router;
