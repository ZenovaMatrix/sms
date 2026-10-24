"use strict";

/**
 * student.validation.js
 *
 * Lightweight, strict input validation for the Students module.
 *
 * Exports:
 *   validateStudentId(id)                      — validates students.id (UUID char(36))
 *   validateUserId(userId)                     — validates users.id / students.user_id (UUID char(36))
 *   validateStudentPaginationAndSearch(query)  — page, limit (max 100), search string
 *   validatePatchStudentPayload(body)          — allowed PATCH fields only, type checks
 *
 * Allowed PATCH fields (confirmed from actual schema):
 *   first_name, last_name, phone, date_of_birth, gender, blood_group, address, status
 *
 * Forbidden / immutable fields (rejected with 400):
 *   id, user_id, student_id, email, admission_date, created_at, updated_at
 *   password_hash, role — and any unknown field
 */

// Matches char(36) UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valid status values from students table ENUM */
const VALID_STUDENT_STATUSES = ["active", "graduated", "transferred", "withdrawn"];

/** Valid gender values from students table ENUM */
const VALID_GENDERS = ["male", "female", "other"];

/** Fields that clients are allowed to PATCH on a student record. */
const ALLOWED_PATCH_FIELDS = new Set([
  "first_name",
  "last_name",
  "phone",
  "date_of_birth",
  "gender",
  "blood_group",
  "address",
  "status",
]);

/**
 * Fields that are explicitly immutable or forbidden.
 * Returning a specific error message for these helps the caller
 * distinguish between "forbidden known field" and "unknown field".
 */
const FORBIDDEN_PATCH_FIELDS = new Set([
  "id",
  "user_id",
  "student_id",
  "email",
  "admission_date",
  "created_at",
  "updated_at",
  "password_hash",
  "role",
]);

// ─── ID Validators ───────────────────────────────────────────────────────────

/**
 * Validates a students.id parameter.
 * @param {string} id
 * @throws {Error} 400 if invalid
 */
function validateStudentId(id) {
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    const err = new Error("Invalid student ID format. Must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return id.trim();
}

/**
 * Validates a users.id / students.user_id parameter.
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

// ─── Pagination + Search ──────────────────────────────────────────────────────

/**
 * Validates and normalizes pagination query parameters for GET /students.
 *
 * @param {{ page?: any, limit?: any, search?: any }} query
 * @returns {{ page: number, limit: number, search: string|null }}
 */
function validateStudentPaginationAndSearch(query) {
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

// ─── PATCH Payload Validator ──────────────────────────────────────────────────

/**
 * Validates a PATCH /students/:id request body.
 *
 * Rules:
 *   - Body must be a non-null, non-array object
 *   - At least one allowed field must be present
 *   - Unknown fields → 400 with field name listed
 *   - Forbidden immutable fields → 400 with explicit error
 *   - Type and value checks for each allowed field
 *
 * @param {object} body - req.body
 * @returns {object} Validated, sanitized update map
 * @throws {Error} 400 on any validation failure
 */
function validatePatchStudentPayload(body) {
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

  // Scan all keys first to catch forbidden/unknown before doing value checks
  for (const key of keys) {
    if (FORBIDDEN_PATCH_FIELDS.has(key)) {
      const err = new Error(
        `Field '${key}' is immutable and cannot be modified.`
      );
      err.statusCode = 400;
      throw err;
    }
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      const err = new Error(
        `Unknown or disallowed field '${key}'. ` +
          `Allowed fields: ${[...ALLOWED_PATCH_FIELDS].join(", ")}.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const updates = {};

  // first_name
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

  // last_name
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

  // phone
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

  // date_of_birth — expects YYYY-MM-DD
  if (body.date_of_birth !== undefined) {
    if (body.date_of_birth !== null) {
      if (typeof body.date_of_birth !== "string") {
        const err = new Error("date_of_birth must be a string in YYYY-MM-DD format or null.");
        err.statusCode = 400;
        throw err;
      }
      const dateVal = new Date(body.date_of_birth);
      if (isNaN(dateVal.getTime())) {
        const err = new Error("date_of_birth must be a valid date in YYYY-MM-DD format.");
        err.statusCode = 400;
        throw err;
      }
    }
    updates.date_of_birth = body.date_of_birth || null;
  }

  // gender — ENUM
  if (body.gender !== undefined) {
    if (body.gender !== null) {
      if (typeof body.gender !== "string" || !VALID_GENDERS.includes(body.gender.trim().toLowerCase())) {
        const err = new Error(
          `gender must be one of: ${VALID_GENDERS.join(", ")}, or null.`
        );
        err.statusCode = 400;
        throw err;
      }
      updates.gender = body.gender.trim().toLowerCase();
    } else {
      updates.gender = null;
    }
  }

  // blood_group
  if (body.blood_group !== undefined) {
    if (body.blood_group !== null) {
      if (typeof body.blood_group !== "string" || body.blood_group.trim().length > 5) {
        const err = new Error("blood_group must be a string of max 5 characters or null.");
        err.statusCode = 400;
        throw err;
      }
      updates.blood_group = body.blood_group.trim();
    } else {
      updates.blood_group = null;
    }
  }

  // address
  if (body.address !== undefined) {
    if (body.address !== null && typeof body.address !== "string") {
      const err = new Error("address must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    updates.address = body.address ? body.address.trim() : null;
  }

  // status — ENUM
  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !VALID_STUDENT_STATUSES.includes(body.status.trim().toLowerCase())
    ) {
      const err = new Error(
        `status must be one of: ${VALID_STUDENT_STATUSES.join(", ")}.`
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
  VALID_STUDENT_STATUSES,
  VALID_GENDERS,
  validateStudentId,
  validateUserId,
  validateStudentPaginationAndSearch,
  validatePatchStudentPayload,
};
