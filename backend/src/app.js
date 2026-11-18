"use strict";

const express = require("express");
const healthRoutes = require("./routes/health.routes");
const userRoutes = require("./modules/users/user.routes");
const authRoutes = require("./modules/auth/auth.routes");
const studentRoutes = require("./modules/students/student.routes");
const teacherRoutes = require("./modules/teachers/teacher.routes");
const parentRoutes = require("./modules/parents/parent.routes");

// Phase 5: Academic Management
const academicYearRoutes = require("./modules/academicYears/academicYear.routes");
const termRoutes = require("./modules/terms/term.routes");
const departmentRoutes = require("./modules/departments/department.routes");
const courseRoutes = require("./modules/courses/course.routes");
const classRoutes = require("./modules/classes/class.routes");
const sectionRoutes = require("./modules/sections/section.routes");
const subjectRoutes = require("./modules/subjects/subject.routes");
const enrollmentRoutes = require("./modules/enrollments/enrollment.routes");
const teacherAssignmentRoutes = require("./modules/teacherAssignments/teacherAssignment.routes");
const attendanceRoutes = require("./modules/attendance/attendance.routes");
const examinationRoutes = require("./modules/examinations/examination.routes");
const examSubjectRoutes = require("./modules/examinations/examSubject.routes");
const resultRoutes = require("./modules/examinations/result.routes");
const feeRoutes = require("./modules/fees/fee.routes");
const announcementRoutes = require("./modules/announcements/announcement.routes");
const deadlineRoutes = require("./modules/deadlines/deadline.routes");
const correctionRoutes = require("./modules/corrections/correction.routes");
const auditRoutes = require("./modules/audit/audit.routes");
const substituteRoutes = require("./modules/substitutes/substitute.routes");

/**
 * app.js
 *
 * Initializes and configures the Express application.
 */

const app = express();

// CORS middleware
const config = require("./config/env");

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = config.frontendUrl;

  if (allowedOrigin === "*" || !origin) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  } else {
    const allowedList = allowedOrigin.split(",").map((s) => s.trim().replace(/\/$/, ""));
    const normalizedOrigin = origin.replace(/\/$/, "");
    if (allowedList.includes(normalizedOrigin) || allowedList.includes("*")) {
      res.header("Access-Control-Allow-Origin", origin);
    }
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Parse JSON request bodies
app.use(express.json());

// API v1 Routes
const authController = require("./modules/auth/auth.controller");

app.use(["/api/v1/health", "/v1/health", "/api/health", "/health"], healthRoutes);
app.use(["/api/v1/users", "/v1/users", "/api/users", "/users"], userRoutes);
app.use(["/api/v1/auth", "/v1/auth", "/api/auth", "/auth"], authRoutes);

// Direct aliases for OTP verification to prevent any route mismatches
app.post(
  ["/api/v1/verify-otp", "/v1/verify-otp", "/api/verify-otp", "/verify-otp"],
  authController.verifyOtp
);
app.post(
  ["/api/v1/auth/verify-otp", "/api/v1/auth/verify_otp", "/api/v1/auth/verify", "/api/v1/auth/otp/verify"],
  authController.verifyOtp
);

app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/teachers", teacherRoutes);
app.use("/api/v1/parents", parentRoutes);

// Phase 5 Academic Routes
app.use("/api/v1/academic-years", academicYearRoutes);
app.use("/api/v1/terms", termRoutes);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/classes", classRoutes);
app.use("/api/v1/sections", sectionRoutes);
app.use("/api/v1/subjects", subjectRoutes);
app.use("/api/v1/enrollments", enrollmentRoutes);
app.use("/api/v1/teacher-assignments", teacherAssignmentRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/examinations", examinationRoutes);
app.use("/api/v1/exam-subjects", examSubjectRoutes);
app.use("/api/v1/results", resultRoutes);
app.use("/api/v1/fees", feeRoutes);
app.use("/api/v1/announcements", announcementRoutes);
app.use("/api/v1/deadlines", deadlineRoutes);
app.use("/api/v1/correction-requests", correctionRoutes);
app.use("/api/v1/audit-logs", auditRoutes);
app.use("/api/v1/substitutes", substituteRoutes);

// Global 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    data: null,
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
      data: null,
    });
  }

  // Handle MySQL duplicate entry error
  if (err.code === "ER_DUP_ENTRY") {
    const isEmail = err.sqlMessage && err.sqlMessage.includes("users.email");
    return res.status(409).json({
      success: false,
      message: isEmail ? "A user with this email already exists" : (err.message || "Duplicate entry detected"),
      data: null,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.statusCode || err.status ? err.message : "An unexpected server error occurred";

  // Log full error internally for debugging, never send stack traces to client
  if (statusCode >= 500) {
    console.error("[Unhandled Error]:", err);
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    data: null,
  });
});

module.exports = app;
