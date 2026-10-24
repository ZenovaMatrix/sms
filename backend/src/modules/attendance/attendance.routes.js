"use strict";

const express = require("express");
const ctrl = require("./attendance.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

// Sessions endpoints
router.get("/sessions", authenticate, authorize("admin", "teacher"), ctrl.getAllSessions);
router.get("/sessions/:id", authenticate, authorize("admin", "teacher"), ctrl.getSessionById);
router.post("/sessions", authenticate, authorize("admin", "teacher"), ctrl.createSession);
router.patch("/sessions/:id", authenticate, authorize("admin", "teacher"), ctrl.patchSession);
router.delete("/sessions/:id", authenticate, authorize("admin", "teacher"), ctrl.removeSession);

// Bulk attendance endpoint (MUST come before /:id)
router.post("/bulk", authenticate, authorize("admin", "teacher"), ctrl.saveBulk);

// Student attendance summary (MUST come before /:id)
router.get(
  "/summary/student/:studentId",
  authenticate,
  authorize("admin", "teacher", "student", "parent"),
  ctrl.getStudentSummary
);

// Attendance records endpoints
router.get(
  "/",
  authenticate,
  authorize("admin", "teacher", "student", "parent"),
  ctrl.getAllAttendance
);
router.get(
  "/:id",
  authenticate,
  authorize("admin", "teacher", "student", "parent"),
  ctrl.getAttendanceById
);
router.post("/", authenticate, authorize("admin", "teacher"), ctrl.createAttendance);
router.patch("/:id", authenticate, authorize("admin", "teacher"), ctrl.patchAttendance);

module.exports = router;
