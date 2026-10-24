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

  const allowed = ["class_id", "section_name", "capacity"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (!body.class_id || typeof body.class_id !== "string" || !UUID_REGEX.test(body.class_id.trim())) {
    const err = new Error("class_id is required and must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  if (!body.section_name || typeof body.section_name !== "string" || !body.section_name.trim()) {
    const err = new Error("section_name is required and must be a non-empty string.");
    err.statusCode = 400;
    throw err;
  }

  if (body.section_name.trim().length > 20) {
    const err = new Error("section_name cannot exceed 20 characters.");
    err.statusCode = 400;
    throw err;
  }

  let capacity = null;
  if (body.capacity !== undefined && body.capacity !== null) {
    const c = parseInt(body.capacity, 10);
    if (isNaN(c) || c <= 0) {
      const err = new Error("capacity must be a positive integer greater than 0.");
      err.statusCode = 400;
      throw err;
    }
    capacity = c;
  }

  return {
    class_id: body.class_id.trim(),
    section_name: body.section_name.trim(),
    capacity,
  };
}

function validatePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["class_id", "section_name", "capacity"];
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
  if (body.class_id !== undefined) {
    if (!body.class_id || typeof body.class_id !== "string" || !UUID_REGEX.test(body.class_id.trim())) {
      const err = new Error("class_id must be a valid UUID.");
      err.statusCode = 400;
      throw err;
    }
    updates.class_id = body.class_id.trim();
  }

  if (body.section_name !== undefined) {
    if (typeof body.section_name !== "string" || !body.section_name.trim()) {
      const err = new Error("section_name must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.section_name.trim().length > 20) {
      const err = new Error("section_name cannot exceed 20 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.section_name = body.section_name.trim();
  }

  if (body.capacity !== undefined) {
    if (body.capacity !== null) {
      const c = parseInt(body.capacity, 10);
      if (isNaN(c) || c <= 0) {
        const err = new Error("capacity must be a positive integer greater than 0, or null.");
        err.statusCode = 400;
        throw err;
      }
      updates.capacity = c;
    } else {
      updates.capacity = null;
    }
  }

  return updates;
}

module.exports = {
  validateId,
  validatePagination,
  validateCreate,
  validatePatch,
};
