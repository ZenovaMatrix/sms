"use strict";

/**
 * teacher.validation.js
 *
 * Strict input validation for the Teachers module.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TEACHER_STATUSES = ["active", "on_leave", "inactive"];

const ALLOWED_PATCH_FIELDS = new Set([
  "first_name",
  "last_name",
  "phone",
  "qualification",
  "joining_date",
  "status",
]);

const FORBIDDEN_PATCH_FIELDS = new Set([
  "id",
  "user_id",
  "employee_id",
  "teacher_id",
  "email",
  "role",
  "department_id",
  "created_at",
  "updated_at",
  "password_hash",
]);

/**
 * Validates a teacher ID parameter (UUID).
 * @param {string} id
 * @throws {Error} 400 if invalid
 */
function validateTeacherId(id) {
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    const err = new Error("Invalid teacher ID format. Must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return id.trim();
}

/**
 * Validates a user ID parameter (UUID).
 * @param {string} userId
 * @throws {Error} 400 if invalid
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== "string" || !UUID_REGEX.test(userId.trim())) {
    const err = new Error("Invalid user ID format. Must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return userId.trim();
}

/**
 * Validates pagination & search params for GET /teachers.
 *
 * @param {{ page?: any, limit?: any, search?: any }} query
 * @returns {{ page: number, limit: number, search: string|null }}
 */
function validateTeacherPaginationAndSearch(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;

  let search = null;
  if (query.search !== undefined && query.search !== null) {
    const s = String(query.search).trim();
    if (s.length > 100) {
      const err = new Error("Search term cannot exceed 100 characters.");
      err.statusCode = 400;
      throw err;
    }
    search = s || null;
  }

  return { page, limit, search };
}

/**
 * Validates PATCH /teachers/:id body.
 *
 * @param {object} body
 * @returns {object}
 */
function validatePatchTeacherPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a valid JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const keys = Object.keys(body);

  if (keys.length === 0) {
    const err = new Error(
      "PATCH body cannot be empty. Provide at least one field: " +
        [...ALLOWED_PATCH_FIELDS].join(", ")
    );
    err.statusCode = 400;
    throw err;
  }

  for (const key of keys) {
    if (FORBIDDEN_PATCH_FIELDS.has(key)) {
      const err = new Error(`Field '${key}' is immutable and cannot be modified.`);
      err.statusCode = 400;
      throw err;
    }
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      const err = new Error(
        `Unknown or disallowed field '${key}'. Allowed fields: ${[...ALLOWED_PATCH_FIELDS].join(", ")}.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const updates = {};

  if (body.first_name !== undefined) {
    if (typeof body.first_name !== "string" || body.first_name.trim() === "") {
      const err = new Error("first_name must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.first_name.trim().length > 100) {
      const err = new Error("first_name cannot exceed 100 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.first_name = body.first_name.trim();
  }

  if (body.last_name !== undefined) {
    if (typeof body.last_name !== "string" || body.last_name.trim() === "") {
      const err = new Error("last_name must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.last_name.trim().length > 100) {
      const err = new Error("last_name cannot exceed 100 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.last_name = body.last_name.trim();
  }

  if (body.phone !== undefined) {
    if (body.phone !== null && typeof body.phone !== "string") {
      const err = new Error("phone must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    if (typeof body.phone === "string" && body.phone.trim().length > 20) {
      const err = new Error("phone cannot exceed 20 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.phone = body.phone ? body.phone.trim() : null;
  }

  if (body.qualification !== undefined) {
    if (body.qualification !== null && typeof body.qualification !== "string") {
      const err = new Error("qualification must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    if (typeof body.qualification === "string" && body.qualification.trim().length > 150) {
      const err = new Error("qualification cannot exceed 150 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.qualification = body.qualification ? body.qualification.trim() : null;
  }

  if (body.joining_date !== undefined) {
    if (body.joining_date !== null) {
      if (typeof body.joining_date !== "string") {
        const err = new Error("joining_date must be a string in YYYY-MM-DD format or null.");
        err.statusCode = 400;
        throw err;
      }
      const dateVal = new Date(body.joining_date);
      if (isNaN(dateVal.getTime())) {
        const err = new Error("joining_date must be a valid date in YYYY-MM-DD format.");
        err.statusCode = 400;
        throw err;
      }
    }
    updates.joining_date = body.joining_date || null;
  }

  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !VALID_TEACHER_STATUSES.includes(body.status.trim().toLowerCase())
    ) {
      const err = new Error(
        `status must be one of: ${VALID_TEACHER_STATUSES.join(", ")}.`
      );
      err.statusCode = 400;
      throw err;
    }
    updates.status = body.status.trim().toLowerCase();
  }

  if (Object.keys(updates).length === 0) {
    const err = new Error(
      "PATCH body produced no valid updates. Provide at least one allowed field with a valid value."
    );
    err.statusCode = 400;
    throw err;
  }

  return updates;
}

module.exports = {
  ALLOWED_PATCH_FIELDS,
  FORBIDDEN_PATCH_FIELDS,
  VALID_TEACHER_STATUSES,
  validateTeacherId,
  validateUserId,
  validateTeacherPaginationAndSearch,
  validatePatchTeacherPayload,
};
