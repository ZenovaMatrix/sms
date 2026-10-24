"use strict";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ["active", "inactive"];

function validateId(id) {
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    const err = new Error("Invalid ID format: must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return id.trim();
}

function validatePagination({ page, limit }) {
  let p = parseInt(page, 10);
  let l = parseInt(limit, 10);
  if (isNaN(p) || p < 1) p = 1;
  if (isNaN(l) || l < 1) l = 20;
  if (l > 100) l = 100;
  return { page: p, limit: l };
}

function validateCreate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["subject_name", "subject_code", "description", "status"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (!body.subject_name || typeof body.subject_name !== "string" || !body.subject_name.trim()) {
    const err = new Error("subject_name is required and must be a non-empty string.");
    err.statusCode = 400;
    throw err;
  }

  if (body.subject_name.trim().length > 100) {
    const err = new Error("subject_name cannot exceed 100 characters.");
    err.statusCode = 400;
    throw err;
  }

  if (!body.subject_code || typeof body.subject_code !== "string" || !body.subject_code.trim()) {
    const err = new Error("subject_code is required and must be a non-empty string.");
    err.statusCode = 400;
    throw err;
  }

  if (body.subject_code.trim().length > 30) {
    const err = new Error("subject_code cannot exceed 30 characters.");
    err.statusCode = 400;
    throw err;
  }

  let description = null;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== "string") {
      const err = new Error("description must be a string.");
      err.statusCode = 400;
      throw err;
    }
    description = body.description.trim() || null;
  }

  let status = "active";
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    status = body.status;
  }

  return {
    subject_name: body.subject_name.trim(),
    subject_code: body.subject_code.trim(),
    description,
    status,
  };
}

function validatePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["subject_name", "subject_code", "description", "status"];
  const keys = Object.keys(body);
  if (keys.length === 0) {
    const err = new Error("Request body cannot be empty.");
    err.statusCode = 400;
    throw err;
  }

  for (const k of keys) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const updates = {};
  if (body.subject_name !== undefined) {
    if (typeof body.subject_name !== "string" || !body.subject_name.trim()) {
      const err = new Error("subject_name must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.subject_name.trim().length > 100) {
      const err = new Error("subject_name cannot exceed 100 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.subject_name = body.subject_name.trim();
  }

  if (body.subject_code !== undefined) {
    if (typeof body.subject_code !== "string" || !body.subject_code.trim()) {
      const err = new Error("subject_code must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.subject_code.trim().length > 30) {
      const err = new Error("subject_code cannot exceed 30 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.subject_code = body.subject_code.trim();
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      const err = new Error("description must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    updates.description = body.description ? body.description.trim() : null;
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    updates.status = body.status;
  }

  return updates;
}

module.exports = {
  validateId,
  validatePagination,
  validateCreate,
  validatePatch,
};
