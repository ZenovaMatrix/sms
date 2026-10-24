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

  const allowed = [
    "teacher_id",
    "subject_id",
    "class_id",
    "section_id",
    "academic_year_id",
    "term_id",
  ];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  for (const r of allowed) {
    if (!body[r]) {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
    if (typeof body[r] !== "string" || !UUID_REGEX.test(body[r].trim())) {
      const err = new Error(`Invalid UUID format for '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  return {
    teacher_id: body.teacher_id.trim(),
    subject_id: body.subject_id.trim(),
    class_id: body.class_id.trim(),
    section_id: body.section_id.trim(),
    academic_year_id: body.academic_year_id.trim(),
    term_id: body.term_id.trim(),
  };
}

function validatePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = [
    "teacher_id",
    "subject_id",
    "class_id",
    "section_id",
    "academic_year_id",
    "term_id",
  ];
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
    if (body[k] !== undefined) {
      if (typeof body[k] !== "string" || !UUID_REGEX.test(body[k].trim())) {
        const err = new Error(`Invalid UUID format for '${k}'`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const updates = {};
  for (const k of allowed) {
    if (body[k] !== undefined) {
      updates[k] = body[k].trim();
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
