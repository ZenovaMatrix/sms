"use strict";

const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const teacherRepository = require("./teacher.repository");
const auditRepo = require("../audit/audit.repository");
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

  // Synchronize linked user if name, phone, or status changed
  if (existing.user_id) {
    const userSets = [];
    const userParams = [];

    if (updates.first_name || updates.last_name) {
      const newFirst = updates.first_name || existing.first_name;
      const newLast = updates.last_name || existing.last_name;
      userSets.push("`name` = ?");
      userParams.push(`${newFirst} ${newLast}`);
    }

    if (updates.phone !== undefined) {
      userSets.push("`phone` = ?");
      userParams.push(updates.phone);
    }

    if (updates.status !== undefined) {
      // If teacher is inactive, mark user inactive. If teacher is active, mark user active.
      const userStatus = updates.status === "inactive" ? "inactive" : "active";
      userSets.push("`status` = ?");
      userParams.push(userStatus);
    }

    if (userSets.length > 0) {
      userParams.push(existing.user_id);
      await pool.execute(`UPDATE users SET ${userSets.join(", ")} WHERE id = ?`, userParams);
    }
  }

  // Write audit log
  await auditRepo.createAuditLog({
    entity_type: "teacher",
    entity_id: cleanId,
    action: "UPDATE_TEACHER",
    user_id: requester.userId || cleanId,
    user_role: requester.role || "admin",
    user_name: requester.userName || "System",
    reason: body.reason || "Profile and assignment update",
    old_values: {
      first_name: existing.first_name,
      last_name: existing.last_name,
      phone: existing.phone,
      department_id: existing.department_id,
      qualification: existing.qualification,
      status: existing.status,
    },
    new_values: updates,
  });

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

  // 1. Check teacher assignments
  const [assignments] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM teacher_assignments WHERE teacher_id = ?`,
    [cleanId]
  );
  // 2. Check substitute assignments
  const [subs] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM substitute_assignments WHERE original_teacher_id = ? OR substitute_teacher_id = ?`,
    [cleanId, cleanId]
  );
  // 3. Check correction requests
  const [corrections] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM correction_requests WHERE teacher_id = ?`,
    [cleanId]
  );

  const totalDeps = Number(assignments[0].cnt) + Number(subs[0].cnt) + Number(corrections[0].cnt);

  if (totalDeps > 0) {
    await teacherRepository.updateTeacher(cleanId, { status: "inactive" });
    if (teacher.user_id) {
      await pool.execute(`UPDATE users SET status = 'inactive' WHERE id = ?`, [teacher.user_id]);
    }

    await auditRepo.createAuditLog({
      entity_type: "teacher",
      entity_id: cleanId,
      action: "ARCHIVE_TEACHER",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.userName || "Administrator",
      reason: `Safe archival due to ${totalDeps} dependent records (${assignments[0].cnt} assignments, ${subs[0].cnt} substitutions, ${corrections[0].cnt} corrections).`,
      old_values: { status: teacher.status },
      new_values: { status: "inactive" },
    });

    return {
      archived: true,
      message: `Teacher has ${totalDeps} historical/active records and was safely archived and deactivated.`,
    };
  }

  // Safe delete
  await teacherRepository.removeTeacher(cleanId);
  if (teacher.user_id) {
    await pool.execute(`DELETE FROM users WHERE id = ?`, [teacher.user_id]);
  }

  await auditRepo.createAuditLog({
    entity_type: "teacher",
    entity_id: cleanId,
    action: "DELETE_TEACHER",
    user_id: requester.userId,
    user_role: requester.role,
    user_name: requester.userName || "Administrator",
    reason: "Safe deletion: zero dependencies found",
    old_values: { employee_id: teacher.employee_id, name: `${teacher.first_name} ${teacher.last_name}` },
  });

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
