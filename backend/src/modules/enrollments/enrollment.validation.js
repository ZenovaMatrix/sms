"use strict";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = ["active", "completed", "transferred", "withdrawn"];

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
    "student_id",
    "academic_year_id",
    "class_id",
    "section_id",
    "course_id",
    "enrollment_date",
    "status",
  ];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["student_id", "academic_year_id", "class_id", "section_id", "enrollment_date"];
  for (const r of required) {
    if (!body[r]) {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  for (const fk of ["student_id", "academic_year_id", "class_id", "section_id"]) {
    if (typeof body[fk] !== "string" || !UUID_REGEX.test(body[fk].trim())) {
      const err = new Error(`Invalid UUID format for '${fk}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  let course_id = null;
  if (body.course_id !== undefined && body.course_id !== null) {
    if (typeof body.course_id !== "string" || !UUID_REGEX.test(body.course_id.trim())) {
      const err = new Error("Invalid UUID format for 'course_id'");
      err.statusCode = 400;
      throw err;
    }
    course_id = body.course_id.trim();
  }

  if (
    typeof body.enrollment_date !== "string" ||
    !DATE_REGEX.test(body.enrollment_date.trim()) ||
    isNaN(Date.parse(body.enrollment_date.trim()))
  ) {
    const err = new Error("enrollment_date must be a valid date in YYYY-MM-DD format.");
    err.statusCode = 400;
    throw err;
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
    student_id: body.student_id.trim(),
    academic_year_id: body.academic_year_id.trim(),
    class_id: body.class_id.trim(),
    section_id: body.section_id.trim(),
    course_id,
    enrollment_date: body.enrollment_date.trim(),
    status,
  };
}

function validatePatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = [
    "class_id",
    "section_id",
    "course_id",
    "enrollment_date",
    "status",
  ];
  const keys = Object.keys(body);
  if (keys.length === 0) {
    const err = new Error("Request body cannot be empty.");
    err.statusCode = 400;
    throw err;
  }

  for (const k of keys) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown or immutable field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const updates = {};
  if (body.class_id !== undefined) {
    if (typeof body.class_id !== "string" || !UUID_REGEX.test(body.class_id.trim())) {
      const err = new Error("Invalid UUID format for 'class_id'");
      err.statusCode = 400;
      throw err;
    }
    updates.class_id = body.class_id.trim();
  }

  if (body.section_id !== undefined) {
    if (typeof body.section_id !== "string" || !UUID_REGEX.test(body.section_id.trim())) {
      const err = new Error("Invalid UUID format for 'section_id'");
      err.statusCode = 400;
      throw err;
    }
    updates.section_id = body.section_id.trim();
  }

  if (body.course_id !== undefined) {
    if (body.course_id !== null) {
      if (typeof body.course_id !== "string" || !UUID_REGEX.test(body.course_id.trim())) {
        const err = new Error("Invalid UUID format for 'course_id'");
        err.statusCode = 400;
        throw err;
      }
      updates.course_id = body.course_id.trim();
    } else {
      updates.course_id = null;
    }
  }

  if (body.enrollment_date !== undefined) {
    if (
      typeof body.enrollment_date !== "string" ||
      !DATE_REGEX.test(body.enrollment_date.trim()) ||
      isNaN(Date.parse(body.enrollment_date.trim()))
    ) {
      const err = new Error("enrollment_date must be a valid date in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    updates.enrollment_date = body.enrollment_date.trim();
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
