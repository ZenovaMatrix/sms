"use strict";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_EXAM_STATUSES = ["upcoming", "ongoing", "completed", "cancelled"];
const VALID_RESULT_STATUSES = ["pass", "fail"];

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

// ─── EXAMS VALIDATION ─────────────────────────────────────────────────────────

function validateCreateExam(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["academic_year_id", "term_id", "class_id", "exam_name", "start_date", "end_date", "status"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["academic_year_id", "term_id", "class_id", "exam_name"];
  for (const r of required) {
    if (!body[r]) {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  for (const fk of ["academic_year_id", "term_id", "class_id"]) {
    if (typeof body[fk] !== "string" || !UUID_REGEX.test(body[fk].trim())) {
      const err = new Error(`Invalid UUID format for '${fk}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (typeof body.exam_name !== "string" || !body.exam_name.trim()) {
    const err = new Error("exam_name is required and must be a non-empty string.");
    err.statusCode = 400;
    throw err;
  }
  if (body.exam_name.trim().length > 100) {
    const err = new Error("exam_name cannot exceed 100 characters.");
    err.statusCode = 400;
    throw err;
  }

  let start_date = null;
  if (body.start_date !== undefined && body.start_date !== null) {
    if (typeof body.start_date !== "string" || !DATE_REGEX.test(body.start_date.trim()) || isNaN(Date.parse(body.start_date.trim()))) {
      const err = new Error("start_date must be a valid date in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    start_date = body.start_date.trim();
  }

  let end_date = null;
  if (body.end_date !== undefined && body.end_date !== null) {
    if (typeof body.end_date !== "string" || !DATE_REGEX.test(body.end_date.trim()) || isNaN(Date.parse(body.end_date.trim()))) {
      const err = new Error("end_date must be a valid date in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    end_date = body.end_date.trim();
  }

  if (start_date && end_date && end_date < start_date) {
    const err = new Error("end_date cannot precede start_date.");
    err.statusCode = 400;
    throw err;
  }

  let status = "upcoming";
  if (body.status !== undefined) {
    if (!VALID_EXAM_STATUSES.includes(body.status)) {
      const err = new Error(`status must be one of: ${VALID_EXAM_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    status = body.status;
  }

  return {
    academic_year_id: body.academic_year_id.trim(),
    term_id: body.term_id.trim(),
    class_id: body.class_id.trim(),
    exam_name: body.exam_name.trim(),
    start_date,
    end_date,
    status,
  };
}

function validatePatchExam(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["exam_name", "start_date", "end_date", "status"];
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
  if (body.exam_name !== undefined) {
    if (typeof body.exam_name !== "string" || !body.exam_name.trim()) {
      const err = new Error("exam_name must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.exam_name.trim().length > 100) {
      const err = new Error("exam_name cannot exceed 100 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.exam_name = body.exam_name.trim();
  }

  if (body.start_date !== undefined) {
    if (body.start_date !== null) {
      if (typeof body.start_date !== "string" || !DATE_REGEX.test(body.start_date.trim()) || isNaN(Date.parse(body.start_date.trim()))) {
        const err = new Error("start_date must be a valid date in YYYY-MM-DD format, or null.");
        err.statusCode = 400;
        throw err;
      }
      updates.start_date = body.start_date.trim();
    } else {
      updates.start_date = null;
    }
  }

  if (body.end_date !== undefined) {
    if (body.end_date !== null) {
      if (typeof body.end_date !== "string" || !DATE_REGEX.test(body.end_date.trim()) || isNaN(Date.parse(body.end_date.trim()))) {
        const err = new Error("end_date must be a valid date in YYYY-MM-DD format, or null.");
        err.statusCode = 400;
        throw err;
      }
      updates.end_date = body.end_date.trim();
    } else {
      updates.end_date = null;
    }
  }

  if (body.status !== undefined) {
    if (!VALID_EXAM_STATUSES.includes(body.status)) {
      const err = new Error(`status must be one of: ${VALID_EXAM_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    updates.status = body.status;
  }

  return updates;
}

// ─── EXAM SUBJECTS VALIDATION ─────────────────────────────────────────────────

function validateCreateExamSubject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["exam_id", "subject_id", "total_marks", "passing_marks", "exam_date"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["exam_id", "subject_id", "total_marks", "passing_marks"];
  for (const r of required) {
    if (body[r] === undefined || body[r] === null || body[r] === "") {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  for (const fk of ["exam_id", "subject_id"]) {
    if (typeof body[fk] !== "string" || !UUID_REGEX.test(body[fk].trim())) {
      const err = new Error(`Invalid UUID format for '${fk}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const total = Number(body.total_marks);
  if (isNaN(total) || total <= 0) {
    const err = new Error("total_marks must be a positive number greater than 0.");
    err.statusCode = 400;
    throw err;
  }

  const passing = Number(body.passing_marks);
  if (isNaN(passing) || passing < 0 || passing > total) {
    const err = new Error("passing_marks must be between 0 and total_marks.");
    err.statusCode = 400;
    throw err;
  }

  let exam_date = null;
  if (body.exam_date !== undefined && body.exam_date !== null) {
    if (typeof body.exam_date !== "string" || !DATE_REGEX.test(body.exam_date.trim()) || isNaN(Date.parse(body.exam_date.trim()))) {
      const err = new Error("exam_date must be a valid date in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    exam_date = body.exam_date.trim();
  }

  return {
    exam_id: body.exam_id.trim(),
    subject_id: body.subject_id.trim(),
    total_marks: total,
    passing_marks: passing,
    exam_date,
  };
}

function validatePatchExamSubject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["total_marks", "passing_marks", "exam_date"];
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
  if (body.total_marks !== undefined) {
    const t = Number(body.total_marks);
    if (isNaN(t) || t <= 0) {
      const err = new Error("total_marks must be a positive number greater than 0.");
      err.statusCode = 400;
      throw err;
    }
    updates.total_marks = t;
  }

  if (body.passing_marks !== undefined) {
    const p = Number(body.passing_marks);
    if (isNaN(p) || p < 0) {
      const err = new Error("passing_marks must be a non-negative number.");
      err.statusCode = 400;
      throw err;
    }
    updates.passing_marks = p;
  }

  if (body.exam_date !== undefined) {
    if (body.exam_date !== null) {
      if (typeof body.exam_date !== "string" || !DATE_REGEX.test(body.exam_date.trim()) || isNaN(Date.parse(body.exam_date.trim()))) {
        const err = new Error("exam_date must be a valid date in YYYY-MM-DD format, or null.");
        err.statusCode = 400;
        throw err;
      }
      updates.exam_date = body.exam_date.trim();
    } else {
      updates.exam_date = null;
    }
  }

  return updates;
}

// ─── RESULTS VALIDATION ───────────────────────────────────────────────────────

function validateCreateResult(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["student_id", "exam_subject_id", "marks_obtained", "grade", "result_status", "remarks"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["student_id", "exam_subject_id", "marks_obtained"];
  for (const r of required) {
    if (body[r] === undefined || body[r] === null || body[r] === "") {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  for (const fk of ["student_id", "exam_subject_id"]) {
    if (typeof body[fk] !== "string" || !UUID_REGEX.test(body[fk].trim())) {
      const err = new Error(`Invalid UUID format for '${fk}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const marks = Number(body.marks_obtained);
  if (isNaN(marks) || marks < 0) {
    const err = new Error("marks_obtained must be a non-negative number.");
    err.statusCode = 400;
    throw err;
  }

  let grade = null;
  if (body.grade !== undefined && body.grade !== null) {
    if (typeof body.grade !== "string" || body.grade.trim().length > 5) {
      const err = new Error("grade cannot exceed 5 characters.");
      err.statusCode = 400;
      throw err;
    }
    grade = body.grade.trim();
  }

  let result_status = null;
  if (body.result_status !== undefined && body.result_status !== null) {
    if (!VALID_RESULT_STATUSES.includes(body.result_status)) {
      const err = new Error(`result_status must be one of: ${VALID_RESULT_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    result_status = body.result_status;
  }

  let remarks = null;
  if (body.remarks !== undefined && body.remarks !== null) {
    if (typeof body.remarks !== "string" || body.remarks.length > 255) {
      const err = new Error("remarks cannot exceed 255 characters.");
      err.statusCode = 400;
      throw err;
    }
    remarks = body.remarks.trim() || null;
  }

  return {
    student_id: body.student_id.trim(),
    exam_subject_id: body.exam_subject_id.trim(),
    marks_obtained: marks,
    grade,
    result_status,
    remarks,
  };
}

function validatePatchResult(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["marks_obtained", "grade", "result_status", "remarks"];
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
  if (body.marks_obtained !== undefined) {
    const m = Number(body.marks_obtained);
    if (isNaN(m) || m < 0) {
      const err = new Error("marks_obtained must be a non-negative number.");
      err.statusCode = 400;
      throw err;
    }
    updates.marks_obtained = m;
  }

  if (body.grade !== undefined) {
    if (body.grade !== null && (typeof body.grade !== "string" || body.grade.trim().length > 5)) {
      const err = new Error("grade cannot exceed 5 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.grade = body.grade ? body.grade.trim() : null;
  }

  if (body.result_status !== undefined) {
    if (body.result_status !== null && !VALID_RESULT_STATUSES.includes(body.result_status)) {
      const err = new Error(`result_status must be one of: ${VALID_RESULT_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    updates.result_status = body.result_status;
  }

  if (body.remarks !== undefined) {
    if (body.remarks !== null && (typeof body.remarks !== "string" || body.remarks.length > 255)) {
      const err = new Error("remarks cannot exceed 255 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.remarks = body.remarks ? body.remarks.trim() : null;
  }

  return updates;
}

module.exports = {
  validateId,
  validatePagination,
  validateCreateExam,
  validatePatchExam,
  validateCreateExamSubject,
  validatePatchExamSubject,
  validateCreateResult,
  validatePatchResult,
};
