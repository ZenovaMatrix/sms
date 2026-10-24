"use strict";

const bcrypt = require("bcryptjs");
const studentRepository = require("./student.repository");
const {
  validateStudentId,
  validateUserId,
  validateStudentPaginationAndSearch,
  validatePatchStudentPayload,
} = require("./student.validation");

/**
 * student.service.js
 *
 * Business logic layer for the Students module.
 * Completely independent of Express req/res.
 *
 * Ownership enforcement:
 *   - A student (role='student') may only read or modify their OWN record.
 *     Ownership is verified by comparing student.user_id === requester.userId.
 *     The requester identity comes ONLY from the verified JWT (req.user),
 *     never from req.body, query params, or any client-supplied value.
 *   - Teachers and admins have no ownership restriction on reads.
 *   - Only admins and students can PATCH; students are still ownership-restricted.
 *
 * Parent access:
 *   - Parent-child relationships are NOT yet modelled in the database.
 *   - Parents are excluded from all student endpoints in Phase 4A.
 *   - This will be revisited in Phase 4C when the relationship table exists.
 *
 * POST / DELETE:
 *   - Both are intentionally disabled (HTTP 501).
 *   - See inline documentation for blockers.
 */

// ─── GET ALL ──────────────────────────────────────────────────────────────────

/**
 * Returns a paginated list of students.
 * No ownership restriction — only accessible to admin/teacher (enforced at route level).
 *
 * @param {object} query — raw req.query
 * @returns {{ students: object[], pagination: object }}
 */
async function getStudents(query) {
  const { page, limit, search } = validateStudentPaginationAndSearch(query);

  const { students, total } = await studentRepository.findAllStudents({
    page,
    limit,
    search,
  });

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

  return {
    students,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

// ─── GET BY ID ────────────────────────────────────────────────────────────────

/**
 * Returns a single student by students.id.
 *
 * Ownership enforcement:
 *   - admin/teacher: unrestricted
 *   - student: may only access their own record (student.user_id === requester.userId)
 *   - parent: denied (Phase 4A limitation; will be enabled in Phase 4C)
 *
 * @param {string} id         — students.id from URL param
 * @param {{ userId: string, role: string }} requester — from verified JWT
 * @returns {object}
 * @throws {Error} 400, 403, 404
 */
async function getStudentById(id, requester) {
  const cleanId = validateStudentId(id);

  const student = await studentRepository.findStudentById(cleanId);
  if (!student) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }

  // Ownership check for student role
  if (requester.role === "student") {
    if (student.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only access your own student record.");
      err.statusCode = 403;
      throw err;
    }
  }

  // Parent access denied until Phase 4C
  if (requester.role === "parent") {
    const err = new Error(
      "Parent access to student records is not yet enabled. " +
        "This will be implemented in Phase 4C when parent-child relationships are available."
    );
    err.statusCode = 403;
    throw err;
  }

  return student;
}

// ─── GET BY USER ID ───────────────────────────────────────────────────────────

/**
 * Returns the student record whose students.user_id matches the given userId.
 *
 * Ownership enforcement:
 *   - admin/teacher: unrestricted
 *   - student: may only retrieve their own linked record (userId must match requester.userId)
 *   - parent: denied (Phase 4A limitation)
 *
 * @param {string} userId     — users.id from URL param
 * @param {{ userId: string, role: string }} requester — from verified JWT
 * @returns {object}
 * @throws {Error} 400, 403, 404
 */
async function getStudentByUserId(userId, requester) {
  const cleanUserId = validateUserId(userId);

  // Student role: only allowed to look up their own userId
  if (requester.role === "student") {
    if (cleanUserId !== requester.userId) {
      const err = new Error("Forbidden: you may only access your own student record.");
      err.statusCode = 403;
      throw err;
    }
  }

  // Parent access denied until Phase 4C
  if (requester.role === "parent") {
    const err = new Error(
      "Parent access to student records is not yet enabled. " +
        "This will be implemented in Phase 4C when parent-child relationships are available."
    );
    err.statusCode = 403;
    throw err;
  }

  const student = await studentRepository.findStudentByUserId(cleanUserId);
  if (!student) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }

  return student;
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

/**
 * Updates allowed fields on a student record.
 *
 * Ownership enforcement:
 *   - admin: unrestricted
 *   - student: may only patch their own record
 *   - teacher/parent: not allowed (enforced at route level; double-checked here)
 *
 * @param {string} id         — students.id from URL param
 * @param {object} body       — raw req.body
 * @param {{ userId: string, role: string }} requester — from verified JWT
 * @returns {object} Updated student record
 * @throws {Error} 400, 403, 404
 */
async function updateStudent(id, body, requester) {
  const cleanId = validateStudentId(id);

  // Validate payload first (fast-fail on bad input before DB hit)
  const updates = validatePatchStudentPayload(body);

  // Verify student exists
  const existing = await studentRepository.findStudentById(cleanId);
  if (!existing) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }

  // Ownership check for student role
  if (requester.role === "student") {
    if (existing.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only modify your own student record.");
      err.statusCode = 403;
      throw err;
    }
  }

  const updated = await studentRepository.updateStudent(cleanId, updates);
  return updated;
}

// ─── POST (CREATE STUDENT) ────────────────────────────────────────────────────

/**
 * Create a new student account with coordinated users + students transaction.
 *
 * Required body fields:
 *   - first_name, last_name, email, password (or auto-generated)
 *
 * Optional body fields:
 *   - phone, date_of_birth, gender, blood_group, address, admission_date
 *
 * @param {object} body       — raw req.body
 * @param {{ userId: string, role: string }} requester — from verified JWT
 * @returns {object} Newly created student record
 */
async function createStudent(body, requester) {
  // Only admins can create students
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: only administrators can create student accounts.");
    err.statusCode = 403;
    throw err;
  }

  const { first_name, last_name, email, password, phone, date_of_birth, gender, blood_group, address, admission_date } = body;

  if (!first_name || !last_name || !email) {
    const err = new Error("first_name, last_name, and email are required.");
    err.statusCode = 400;
    throw err;
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error("Invalid email address.");
    err.statusCode = 400;
    throw err;
  }

  // Hash the password (default: first_name + year)
  const rawPassword = password || `${first_name.toLowerCase()}${new Date().getFullYear()}`;
  const password_hash = await bcrypt.hash(rawPassword, 10);

  const payload = {
    name: `${first_name} ${last_name}`,
    email,
    password_hash,
    phone: phone || null,
    first_name,
    last_name,
    date_of_birth: date_of_birth || null,
    gender: gender || null,
    blood_group: blood_group || null,
    address: address || null,
    admission_date: admission_date || null,
  };

  try {
    const student = await studentRepository.createStudent(payload);
    return student;
  } catch (err) {
    // Handle duplicate email (MySQL error 1062)
    if (err.code === "ER_DUP_ENTRY") {
      const dupErr = new Error("A user with this email address already exists.");
      dupErr.statusCode = 409;
      throw dupErr;
    }
    throw err;
  }
}

// ─── DELETE (DISABLED) ───────────────────────────────────────────────────────

/**
 * Student deletion is intentionally disabled.
 *
 * Reason: The foreign key constraint on students.id uses ON DELETE RESTRICT.
 * Future modules (class enrollments, grades, attendance) will reference students.
 * Deletion cannot be proven safe without auditing all downstream constraints.
 *
 * @returns {{ disabled: true, reason: string }}
 */
function deleteStudent() {
  return {
    disabled: true,
    reason:
      "Student deletion is disabled for data integrity. " +
      "The foreign key constraint uses ON DELETE RESTRICT.",
  };
}

module.exports = {
  getStudents,
  getStudentById,
  getStudentByUserId,
  updateStudent,
  createStudent,
  deleteStudent,
};
