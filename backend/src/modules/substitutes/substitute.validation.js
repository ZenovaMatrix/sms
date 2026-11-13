"use strict";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateId(id, fieldName = "ID") {
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    const err = new Error(`Invalid ${fieldName}: must be a valid UUID.`);
    err.statusCode = 400;
    throw err;
  }
  return id.trim();
}

function validateAssignSubstitutePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const {
    original_teacher_id,
    substitute_teacher_id,
    class_id,
    section_id,
    subject_id,
    start_date,
    end_date,
    reason,
    notes,
  } = body;

  const validOriginal = validateId(original_teacher_id, "original_teacher_id");
  const validSubstitute = validateId(substitute_teacher_id, "substitute_teacher_id");
  const validClass = validateId(class_id, "class_id");
  const validSection = validateId(section_id, "section_id");
  const validSubject = validateId(subject_id, "subject_id");

  if (validOriginal === validSubstitute) {
    const err = new Error("Substitute teacher cannot be the same as the absent teacher.");
    err.statusCode = 400;
    throw err;
  }

  if (!start_date || !DATE_REGEX.test(String(start_date))) {
    const err = new Error("start_date must be in YYYY-MM-DD format.");
    err.statusCode = 400;
    throw err;
  }

  if (!end_date || !DATE_REGEX.test(String(end_date))) {
    const err = new Error("end_date must be in YYYY-MM-DD format.");
    err.statusCode = 400;
    throw err;
  }

  if (start_date > end_date) {
    const err = new Error("start_date cannot be after end_date.");
    err.statusCode = 400;
    throw err;
  }

  return {
    original_teacher_id: validOriginal,
    substitute_teacher_id: validSubstitute,
    class_id: validClass,
    section_id: validSection,
    subject_id: validSubject,
    start_date: String(start_date),
    end_date: String(end_date),
    reason: reason ? String(reason).trim() : "Faculty Leave / Temporary Coverage",
    notes: notes ? String(notes).trim() : null,
  };
}

module.exports = {
  validateId,
  validateAssignSubstitutePayload,
};

