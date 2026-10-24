"use strict";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const VALID_STATUSES = ["present", "absent", "late", "excused"];

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

function normalizeTime(t) {
  if (t.length === 5) return t + ":00";
  return t;
}

function validateCreateSession(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["teacher_assignment_id", "session_date", "start_time", "end_time"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["teacher_assignment_id", "session_date", "start_time"];
  for (const r of required) {
    if (!body[r]) {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (typeof body.teacher_assignment_id !== "string" || !UUID_REGEX.test(body.teacher_assignment_id.trim())) {
    const err = new Error("teacher_assignment_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  if (
    typeof body.session_date !== "string" ||
    !DATE_REGEX.test(body.session_date.trim()) ||
    isNaN(Date.parse(body.session_date.trim()))
  ) {
    const err = new Error("session_date must be a valid date in YYYY-MM-DD format.");
    err.statusCode = 400;
    throw err;
  }

  if (typeof body.start_time !== "string" || !TIME_REGEX.test(body.start_time.trim())) {
    const err = new Error("start_time must be a valid time in HH:MM or HH:MM:SS format.");
    err.statusCode = 400;
    throw err;
  }

  const startTimeNorm = normalizeTime(body.start_time.trim());
  let endTimeNorm = null;

  if (body.end_time !== undefined && body.end_time !== null) {
    if (typeof body.end_time !== "string" || !TIME_REGEX.test(body.end_time.trim())) {
      const err = new Error("end_time must be a valid time in HH:MM or HH:MM:SS format.");
      err.statusCode = 400;
      throw err;
    }
    endTimeNorm = normalizeTime(body.end_time.trim());
    if (endTimeNorm <= startTimeNorm) {
      const err = new Error("end_time must be later than start_time.");
      err.statusCode = 400;
      throw err;
    }
  }

  return {
    teacher_assignment_id: body.teacher_assignment_id.trim(),
    session_date: body.session_date.trim(),
    start_time: startTimeNorm,
    end_time: endTimeNorm,
  };
}

function validatePatchSession(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["session_date", "start_time", "end_time"];
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
  if (body.session_date !== undefined) {
    if (
      typeof body.session_date !== "string" ||
      !DATE_REGEX.test(body.session_date.trim()) ||
      isNaN(Date.parse(body.session_date.trim()))
    ) {
      const err = new Error("session_date must be a valid date in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    updates.session_date = body.session_date.trim();
  }

  if (body.start_time !== undefined) {
    if (typeof body.start_time !== "string" || !TIME_REGEX.test(body.start_time.trim())) {
      const err = new Error("start_time must be a valid time in HH:MM or HH:MM:SS format.");
      err.statusCode = 400;
      throw err;
    }
    updates.start_time = normalizeTime(body.start_time.trim());
  }

  if (body.end_time !== undefined) {
    if (body.end_time !== null) {
      if (typeof body.end_time !== "string" || !TIME_REGEX.test(body.end_time.trim())) {
        const err = new Error("end_time must be a valid time in HH:MM or HH:MM:SS format, or null.");
        err.statusCode = 400;
        throw err;
      }
      updates.end_time = normalizeTime(body.end_time.trim());
    } else {
      updates.end_time = null;
    }
  }

  return updates;
}

function validateCreateAttendance(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["attendance_session_id", "student_id", "status", "remarks"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["attendance_session_id", "student_id", "status"];
  for (const r of required) {
    if (!body[r]) {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (typeof body.attendance_session_id !== "string" || !UUID_REGEX.test(body.attendance_session_id.trim())) {
    const err = new Error("attendance_session_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  if (typeof body.student_id !== "string" || !UUID_REGEX.test(body.student_id.trim())) {
    const err = new Error("student_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  if (!VALID_STATUSES.includes(body.status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  let remarks = null;
  if (body.remarks !== undefined && body.remarks !== null) {
    if (typeof body.remarks !== "string") {
      const err = new Error("remarks must be a string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.remarks.length > 255) {
      const err = new Error("remarks cannot exceed 255 characters.");
      err.statusCode = 400;
      throw err;
    }
    remarks = body.remarks.trim() || null;
  }

  return {
    attendance_session_id: body.attendance_session_id.trim(),
    student_id: body.student_id.trim(),
    status: body.status,
    remarks,
  };
}

function validatePatchAttendance(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["status", "remarks"];
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
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    updates.status = body.status;
  }

  if (body.remarks !== undefined) {
    if (body.remarks !== null && typeof body.remarks !== "string") {
      const err = new Error("remarks must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    if (typeof body.remarks === "string" && body.remarks.length > 255) {
      const err = new Error("remarks cannot exceed 255 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.remarks = body.remarks ? body.remarks.trim() : null;
  }

  return updates;
}

function validateBulkAttendance(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const sessionId = body.attendance_session_id || body.session_id;
  if (!sessionId || typeof sessionId !== "string" || !UUID_REGEX.test(sessionId.trim())) {
    const err = new Error("attendance_session_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(body.records) || body.records.length === 0) {
    const err = new Error("records must be a non-empty array.");
    err.statusCode = 400;
    throw err;
  }

  const studentSet = new Set();
  const normalizedRecords = [];

  for (let i = 0; i < body.records.length; i++) {
    const r = body.records[i];
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      const err = new Error(`Record at index ${i} must be a JSON object.`);
      err.statusCode = 400;
      throw err;
    }

    if (!r.student_id || typeof r.student_id !== "string" || !UUID_REGEX.test(r.student_id.trim())) {
      const err = new Error(`Record at index ${i} has invalid student_id.`);
      err.statusCode = 400;
      throw err;
    }

    const sid = r.student_id.trim();
    if (studentSet.has(sid)) {
      const err = new Error(`Duplicate student_id '${sid}' found in bulk attendance payload.`);
      err.statusCode = 400;
      throw err;
    }
    studentSet.add(sid);

    if (!r.status || !VALID_STATUSES.includes(r.status)) {
      const err = new Error(`Record at index ${i} has invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }

    let remarks = null;
    if (r.remarks !== undefined && r.remarks !== null) {
      if (typeof r.remarks !== "string" || r.remarks.length > 255) {
        const err = new Error(`Record at index ${i} has invalid remarks.`);
        err.statusCode = 400;
        throw err;
      }
      remarks = r.remarks.trim() || null;
    }

    normalizedRecords.push({
      student_id: sid,
      status: r.status,
      remarks,
    });
  }

  return {
    attendance_session_id: sessionId.trim(),
    records: normalizedRecords,
  };
}

module.exports = {
  validateId,
  validatePagination,
  validateCreateSession,
  validatePatchSession,
  validateCreateAttendance,
  validatePatchAttendance,
  validateBulkAttendance,
};
