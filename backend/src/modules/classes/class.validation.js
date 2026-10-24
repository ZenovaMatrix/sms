"use strict";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const allowed = ["class_name", "description"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (!body.class_name || typeof body.class_name !== "string" || !body.class_name.trim()) {
    const err = new Error("class_name is required and must be a non-empty string.");
    err.statusCode = 400;
    throw err;
  }

  if (body.class_name.trim().length > 50) {
    const err = new Error("class_name cannot exceed 50 characters.");
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
    if (body.description.length > 255) {
      const err = new Error("description cannot exceed 255 characters.");
      err.statusCode = 400;
      throw err;
    }
    description = body.description.trim() || null;
  }

  return {
    class_name: body.class_name.trim(),
    description,
  };
}

function validatePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["class_name", "description"];
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
  if (body.class_name !== undefined) {
    if (typeof body.class_name !== "string" || !body.class_name.trim()) {
      const err = new Error("class_name must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.class_name.trim().length > 50) {
      const err = new Error("class_name cannot exceed 50 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.class_name = body.class_name.trim();
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      const err = new Error("description must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    if (typeof body.description === "string" && body.description.length > 255) {
      const err = new Error("description cannot exceed 255 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.description = body.description ? body.description.trim() : null;
  }

  return updates;
}

module.exports = {
  validateId,
  validatePagination,
  validateCreate,
  validatePatch,
};
