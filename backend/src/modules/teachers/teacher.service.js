"use strict";

const bcrypt = require("bcryptjs");
const teacherRepository = require("./teacher.repository");
const {
  validateTeacherId,
  validateUserId,
  validateTeacherPaginationAndSearch,
  validatePatchTeacherPayload,
} = require("./teacher.validation");

/**
 * teacher.service.js
 *
 * Business logic layer for the Teachers module.
 * Independent of Express req/res.
 */

// ─── GET ALL ──────────────────────────────────────────────────────────────────

async function getTeachers(query) {
  const { page, limit, search } = validateTeacherPaginationAndSearch(query);

  const { teachers, total } = await teacherRepository.findAllTeachers({
    page,
    limit,
    search,
  });

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

  return {
    teachers,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

// ─── GET BY ID ────────────────────────────────────────────────────────────────

async function getTeacherById(id, requester) {
  const cleanId = validateTeacherId(id);

  const teacher = await teacherRepository.findTeacherById(cleanId);
  if (!teacher) {
    const err = new Error("Teacher not found");
    err.statusCode = 404;
    throw err;
  }

  // Teacher role ownership check: may only access own record
  if (requester.role === "teacher") {
    if (teacher.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only access your own teacher record.");
      err.statusCode = 403;
      throw err;
    }
  }

  return teacher;
}

// ─── GET BY USER ID ───────────────────────────────────────────────────────────

async function getTeacherByUserId(userId, requester) {
  const cleanUserId = validateUserId(userId);

  // Teacher role ownership check: may only access own userId
  if (requester.role === "teacher") {
    if (cleanUserId !== requester.userId) {
      const err = new Error("Forbidden: you may only access your own teacher record.");
      err.statusCode = 403;
      throw err;
    }
  }

  const teacher = await teacherRepository.findTeacherByUserId(cleanUserId);
  if (!teacher) {
    const err = new Error("Teacher not found");
    err.statusCode = 404;
    throw err;
  }

  return teacher;
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

async function updateTeacher(id, body, requester) {
  const cleanId = validateTeacherId(id);
  const updates = validatePatchTeacherPayload(body);

  const existing = await teacherRepository.findTeacherById(cleanId);
  if (!existing) {
    const err = new Error("Teacher not found");
    err.statusCode = 404;
    throw err;
  }

  // Teacher role ownership check: may only update own record
  if (requester.role === "teacher") {
    if (existing.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only modify your own teacher record.");
      err.statusCode = 403;
      throw err;
    }
  }

  const updated = await teacherRepository.updateTeacher(cleanId, updates);
  return updated;
}

// ─── POST (CREATE TEACHER) ───────────────────────────────────────────────────

async function createTeacher(body, requester) {
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: only administrators can create teacher accounts.");
    err.statusCode = 403;
    throw err;
  }

  const { first_name, last_name, email, password, phone, department_id, qualification, joining_date } = body;

  if (!first_name || !last_name || !email) {
    const err = new Error("first_name, last_name, and email are required.");
    err.statusCode = 400;
    throw err;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error("Invalid email address.");
    err.statusCode = 400;
    throw err;
  }

  const rawPassword = password || `${first_name.toLowerCase()}${new Date().getFullYear()}`;
  const password_hash = await bcrypt.hash(rawPassword, 10);

  const payload = {
    name: `${first_name} ${last_name}`,
    email,
    password_hash,
    phone: phone || null,
    first_name,
    last_name,
    department_id: department_id || null,
    qualification: qualification || null,
    joining_date: joining_date || null,
  };

  try {
    return await teacherRepository.createTeacher(payload);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      const dupErr = new Error("A user with this email address already exists.");
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

// ─── DELETE / ARCHIVE ────────────────────────────────────────────────────────

async function deleteTeacher(id, requester) {
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: only administrators can delete teachers.");
    err.statusCode = 403;
    throw err;
  }

  const cleanId = validateTeacherId(id);
  const teacher = await teacherRepository.findTeacherById(cleanId);
  if (!teacher) {
    const err = new Error("Teacher not found.");
    err.statusCode = 404;
    throw err;
  }

  const pool = require("../../config/db");
  const [assignments] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM teacher_assignments WHERE teacher_id = ?`,
    [cleanId]
  );

  if (Number(assignments[0].cnt) > 0) {
    await teacherRepository.updateTeacher(cleanId, { status: "inactive" });
    return {
      archived: true,
      message: "Teacher has active assignments and was safely archived and deactivated.",
    };
  }

  await teacherRepository.removeTeacher(cleanId);
  return {
    deleted: true,
    message: "Teacher deleted successfully.",
  };
}

module.exports = {
  getTeachers,
  getTeacherById,
  getTeacherByUserId,
  updateTeacher,
  createTeacher,
  deleteTeacher,
};
