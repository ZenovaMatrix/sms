"use strict";

/**
 * parent.validation.js
 *
 * Strict input validation for Parents and Student-Parent Relationships.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_RELATIONSHIPS = ["father", "mother", "guardian", "other"];

const ALLOWED_PATCH_FIELDS = new Set([
  "full_name",
  "phone",
  "email",
  "occupation",
  "address",
  "status",
]);

const FORBIDDEN_PATCH_FIELDS = new Set([
  "id",
  "user_id",
  "role",
  "password_hash",
  "created_at",
  "updated_at",
]);

function validateParentId(id) {
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    const err = new Error("Invalid parent ID format. Must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return id.trim();
}

function validateUserId(userId) {
  if (!userId || typeof userId !== "string" || !UUID_REGEX.test(userId.trim())) {
    const err = new Error("Invalid user ID format. Must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return userId.trim();
}

function validateStudentId(studentId) {
  if (!studentId || typeof studentId !== "string" || !UUID_REGEX.test(studentId.trim())) {
    const err = new Error("Invalid student ID format. Must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return studentId.trim();
}

function validateParentPaginationAndSearch(query) {
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

  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const student_id = query.student_id ? String(query.student_id).trim() : null;

  return { page, limit, search, class_id, section_id, student_id };
}

function validatePatchParentPayload(body) {
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

  if (body.full_name !== undefined) {
    if (typeof body.full_name !== "string" || body.full_name.trim() === "") {
      const err = new Error("full_name must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.full_name.trim().length > 150) {
      const err = new Error("full_name cannot exceed 150 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.full_name = body.full_name.trim();
  }

  if (body.phone !== undefined) {
    if (typeof body.phone !== "string" || body.phone.trim() === "") {
      const err = new Error("phone must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.phone.trim().length > 20) {
      const err = new Error("phone cannot exceed 20 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.phone = body.phone.trim();
  }

  if (body.email !== undefined) {
    if (body.email !== null && typeof body.email !== "string") {
      const err = new Error("email must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    if (typeof body.email === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email.trim())) {
        const err = new Error("email must be a valid email address.");
        err.statusCode = 400;
        throw err;
      }
      updates.email = body.email.trim().toLowerCase();
    } else {
      updates.email = null;
    }
  }

  if (body.occupation !== undefined) {
    if (body.occupation !== null && typeof body.occupation !== "string") {
      const err = new Error("occupation must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    if (typeof body.occupation === "string" && body.occupation.trim().length > 100) {
      const err = new Error("occupation cannot exceed 100 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.occupation = body.occupation ? body.occupation.trim() : null;
  }

  if (body.address !== undefined) {
    if (body.address !== null && typeof body.address !== "string") {
      const err = new Error("address must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    updates.address = body.address ? body.address.trim() : null;
  }

  if (body.status !== undefined) {
    const s = String(body.status).trim().toLowerCase();
    if (!["active", "inactive", "suspended"].includes(s)) {
      const err = new Error("status must be one of: active, inactive, suspended.");
      err.statusCode = 400;
      throw err;
    }
    updates.status = s;
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

function validateCreateRelationshipPayload(body = {}) {
  const relationship = body.relationship ? String(body.relationship).trim().toLowerCase() : "other";
  if (!VALID_RELATIONSHIPS.includes(relationship)) {
    const err = new Error(
      `relationship must be one of: ${VALID_RELATIONSHIPS.join(", ")}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const isPrimaryContact = body.is_primary_contact ? 1 : 0;
  const isEmergencyContact = body.is_emergency_contact ? 1 : 0;

  return {
    relationship,
    isPrimaryContact,
    isEmergencyContact,
  };
}

module.exports = {
  ALLOWED_PATCH_FIELDS,
  FORBIDDEN_PATCH_FIELDS,
  VALID_RELATIONSHIPS,
  validateParentId,
  validateUserId,
  validateStudentId,
  validateParentPaginationAndSearch,
  validatePatchParentPayload,
  validateCreateRelationshipPayload,
};
