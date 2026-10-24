"use strict";

const studentService = require("./student.service");

/**
 * student.controller.js
 *
 * HTTP controller for the Students module.
 *
 * Responsibilities:
 *   - Extract req.params, req.query, req.body
 *   - Pass requester identity (req.user) from verified JWT to service
 *   - Format standardized JSON responses
 *   - Delegate all business logic and validation to studentService
 *   - Forward errors to centralized error handler via next(error)
 *
 * Standard response shape:
 *   { success: true|false, message: string, data: object|null }
 */

// ─── GET /students ───────────────────────────────────────────────────────────

async function getAllStudents(req, res, next) {
  try {
    const result = await studentService.getStudents(req.query);
    return res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

// ─── GET /students/:id ───────────────────────────────────────────────────────

async function getStudentById(req, res, next) {
  try {
    const student = await studentService.getStudentById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: "Student fetched successfully",
      data: student,
    });
  } catch (error) {
    return next(error);
  }
}

// ─── GET /students/user/:userId ──────────────────────────────────────────────

async function getStudentByUserId(req, res, next) {
  try {
    const student = await studentService.getStudentByUserId(req.params.userId, req.user);
    return res.status(200).json({
      success: true,
      message: "Student fetched successfully",
      data: student,
    });
  } catch (error) {
    return next(error);
  }
}

// ─── PATCH /students/:id ─────────────────────────────────────────────────────

async function updateStudent(req, res, next) {
  try {
    const updated = await studentService.updateStudent(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
}

// ─── POST /students ───────────────────────────────────────────────────────────

async function createStudent(req, res, next) {
  try {
    const student = await studentService.createStudent(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: student,
    });
  } catch (error) {
    return next(error);
  }
}

// ─── DELETE /students/:id (DISABLED — 501) ───────────────────────────────────

/**
 * Student deletion is intentionally disabled to preserve data integrity.
 *
 * Reason: The students table uses ON DELETE RESTRICT on its foreign key.
 * Future modules (enrollments, grades, attendance) will reference students.
 * Deletion cannot be proven safe without auditing all downstream constraints.
 */
async function deleteStudent(req, res) {
  return res.status(501).json({
    success: false,
    message: "Student deletion is disabled for data integrity.",
    data: null,
  });
}

const parentService = require("../parents/parent.service");

async function getStudentParents(req, res, next) {
  try {
    const parents = await parentService.getParentsByStudentId(req.params.studentId || req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: "Student parents fetched successfully",
      data: parents,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAllStudents,
  getStudentById,
  getStudentByUserId,
  updateStudent,
  createStudent,
  deleteStudent,
  getStudentParents,
};
