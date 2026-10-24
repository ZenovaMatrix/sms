"use strict";

/**
 * term.validation.js
 *
 * Schema (confirmed via SHOW CREATE TABLE):
 *   id               char(36) NOT NULL
 *   academic_year_id char(36) NOT NULL  FK→academic_years RESTRICT
 *   term_name        varchar(50) NOT NULL
 *   start_date       date NOT NULL
 *   end_date         date NOT NULL
 *   status           enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming'
 *   UNIQUE(academic_year_id, term_name)
 *   CHECK(end_date > start_date)
 */

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ["upcoming", "active", "completed"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidUUID(v) { return typeof v === "string" && VALID_UUID.test(v); }
function isValidDate(v) {
  if (typeof v !== "string" || !DATE_REGEX.test(v)) return false;
  return !isNaN(new Date(v).getTime());
}

function validateId(id) {
  if (!isValidUUID(id)) {
    const e = new Error("Invalid term ID. Must be a valid UUID."); e.statusCode = 400; throw e;
  }
  return id.toLowerCase();
}

function validateAcademicYearId(id) {
  if (!isValidUUID(id)) {
    const e = new Error("Invalid academic_year_id. Must be a valid UUID."); e.statusCode = 400; throw e;
  }
  return id.toLowerCase();
}

function validateListQuery(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) { const e = new Error("limit must not exceed 100."); e.statusCode = 400; throw e; }

  let academic_year_id = null;
  if (query.academic_year_id !== undefined) {
    academic_year_id = validateAcademicYearId(query.academic_year_id);
  }

  let status = null;
  if (query.status !== undefined) {
    if (!VALID_STATUSES.includes(query.status)) {
      const e = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`); e.statusCode = 400; throw e;
    }
    status = query.status;
  }

  const search = typeof query.search === "string" ? query.search.trim() : null;
  return { page, limit, academic_year_id, status, search };
}

function validateCreatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const e = new Error("Request body must be a JSON object."); e.statusCode = 400; throw e;
  }

  const ALLOWED = new Set(["academic_year_id", "term_name", "start_date", "end_date", "status"]);
  const REQUIRED = ["academic_year_id", "term_name", "start_date", "end_date"];

  for (const k of Object.keys(body)) {
    if (!ALLOWED.has(k)) { const e = new Error(`Unknown field: "${k}".`); e.statusCode = 400; throw e; }
  }
  for (const f of REQUIRED) {
    if (!body[f]) { const e = new Error(`"${f}" is required.`); e.statusCode = 400; throw e; }
  }

  if (!isValidUUID(body.academic_year_id)) {
    const e = new Error("academic_year_id must be a valid UUID."); e.statusCode = 400; throw e;
  }

  const term_name = String(body.term_name).trim();
  if (term_name.length === 0 || term_name.length > 50) {
    const e = new Error("term_name must be between 1 and 50 characters."); e.statusCode = 400; throw e;
  }

  if (!isValidDate(body.start_date)) {
    const e = new Error("start_date must be a valid date YYYY-MM-DD."); e.statusCode = 400; throw e;
  }
  if (!isValidDate(body.end_date)) {
    const e = new Error("end_date must be a valid date YYYY-MM-DD."); e.statusCode = 400; throw e;
  }
  if (new Date(body.end_date) <= new Date(body.start_date)) {
    const e = new Error("end_date must be after start_date."); e.statusCode = 400; throw e;
  }

  let status = "upcoming";
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      const e = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`); e.statusCode = 400; throw e;
    }
    status = body.status;
  }

  return { academic_year_id: body.academic_year_id.toLowerCase(), term_name, start_date: body.start_date, end_date: body.end_date, status };
}

function validatePatchPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const e = new Error("Request body must be a JSON object."); e.statusCode = 400; throw e;
  }
  const ALLOWED = new Set(["term_name", "start_date", "end_date", "status"]);
  const FORBIDDEN = new Set(["id", "academic_year_id"]);
  const keys = Object.keys(body);
  if (keys.length === 0) { const e = new Error("PATCH body must contain at least one field."); e.statusCode = 400; throw e; }

  for (const k of keys) {
    if (FORBIDDEN.has(k)) { const e = new Error(`"${k}" cannot be changed.`); e.statusCode = 400; throw e; }
    if (!ALLOWED.has(k)) { const e = new Error(`Unknown field: "${k}".`); e.statusCode = 400; throw e; }
  }

  const updates = {};
  if (body.term_name !== undefined) {
    const n = String(body.term_name).trim();
    if (!n.length || n.length > 50) { const e = new Error("term_name must be 1–50 chars."); e.statusCode = 400; throw e; }
    updates.term_name = n;
  }
  if (body.start_date !== undefined) {
    if (!isValidDate(body.start_date)) { const e = new Error("Invalid start_date."); e.statusCode = 400; throw e; }
    updates.start_date = body.start_date;
  }
  if (body.end_date !== undefined) {
    if (!isValidDate(body.end_date)) { const e = new Error("Invalid end_date."); e.statusCode = 400; throw e; }
    updates.end_date = body.end_date;
  }
  if (updates.start_date && updates.end_date) {
    if (new Date(updates.end_date) <= new Date(updates.start_date)) {
      const e = new Error("end_date must be after start_date."); e.statusCode = 400; throw e;
    }
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      const e = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`); e.statusCode = 400; throw e;
    }
    updates.status = body.status;
  }
  return updates;
}

module.exports = { validateId, validateListQuery, validateCreatePayload, validatePatchPayload };
