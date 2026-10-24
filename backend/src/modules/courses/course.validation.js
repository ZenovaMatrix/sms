"use strict";

/**
 * course.validation.js
 * Schema: id, department_id (nullable FK→departments SET NULL), course_name, course_code (UNIQUE), description, status (active/inactive), created_at
 */

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ["active", "inactive"];
function isUUID(v) { return typeof v === "string" && VALID_UUID.test(v); }

function validateId(id) {
  if (!isUUID(id)) { const e = new Error("Invalid course ID."); e.statusCode = 400; throw e; }
  return id.toLowerCase();
}

function validateListQuery(query) {
  let page = parseInt(query.page, 10); let limit = parseInt(query.limit, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) { const e = new Error("limit must not exceed 100."); e.statusCode = 400; throw e; }

  let department_id = null;
  if (query.department_id !== undefined) {
    if (!isUUID(query.department_id)) { const e = new Error("Invalid department_id."); e.statusCode = 400; throw e; }
    department_id = query.department_id.toLowerCase();
  }
  let status = null;
  if (query.status !== undefined) {
    if (!VALID_STATUSES.includes(query.status)) { const e = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`); e.statusCode = 400; throw e; }
    status = query.status;
  }
  const search = typeof query.search === "string" ? query.search.trim() : null;
  return { page, limit, department_id, status, search };
}

function validateCreatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const e = new Error("Request body must be a JSON object."); e.statusCode = 400; throw e;
  }
  const ALLOWED = new Set(["department_id", "course_name", "course_code", "description", "status"]);
  for (const k of Object.keys(body)) {
    if (!ALLOWED.has(k)) { const e = new Error(`Unknown field: "${k}".`); e.statusCode = 400; throw e; }
  }
  if (!body.course_name) { const e = new Error('"course_name" is required.'); e.statusCode = 400; throw e; }
  if (!body.course_code) { const e = new Error('"course_code" is required.'); e.statusCode = 400; throw e; }

  const course_name = String(body.course_name).trim();
  const course_code = String(body.course_code).trim().toUpperCase();
  if (!course_name.length || course_name.length > 100) { const e = new Error("course_name must be 1–100 chars."); e.statusCode = 400; throw e; }
  if (!course_code.length || course_code.length > 30) { const e = new Error("course_code must be 1–30 chars."); e.statusCode = 400; throw e; }

  let department_id = null;
  if (body.department_id !== undefined && body.department_id !== null && body.department_id !== "") {
    if (!isUUID(body.department_id)) { const e = new Error("department_id must be a valid UUID."); e.statusCode = 400; throw e; }
    department_id = body.department_id.toLowerCase();
  }

  let status = "active";
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) { const e = new Error(`Invalid status.`); e.statusCode = 400; throw e; }
    status = body.status;
  }
  const description = body.description !== undefined ? String(body.description).trim() || null : null;
  return { department_id, course_name, course_code, description, status };
}

function validatePatchPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const e = new Error("Request body must be a JSON object."); e.statusCode = 400; throw e;
  }
  const ALLOWED = new Set(["department_id", "course_name", "course_code", "description", "status"]);
  const FORBIDDEN = new Set(["id", "created_at"]);
  const keys = Object.keys(body);
  if (!keys.length) { const e = new Error("PATCH body must contain at least one field."); e.statusCode = 400; throw e; }
  for (const k of keys) {
    if (FORBIDDEN.has(k)) { const e = new Error(`"${k}" is immutable.`); e.statusCode = 400; throw e; }
    if (!ALLOWED.has(k)) { const e = new Error(`Unknown field: "${k}".`); e.statusCode = 400; throw e; }
  }
  const updates = {};
  if (body.course_name !== undefined) {
    const n = String(body.course_name).trim();
    if (!n.length || n.length > 100) { const e = new Error("course_name 1–100 chars."); e.statusCode = 400; throw e; }
    updates.course_name = n;
  }
  if (body.course_code !== undefined) {
    const c = String(body.course_code).trim().toUpperCase();
    if (!c.length || c.length > 30) { const e = new Error("course_code 1–30 chars."); e.statusCode = 400; throw e; }
    updates.course_code = c;
  }
  if ("department_id" in body) {
    if (body.department_id === null || body.department_id === "") {
      updates.department_id = null;
    } else {
      if (!isUUID(body.department_id)) { const e = new Error("department_id must be a valid UUID or null."); e.statusCode = 400; throw e; }
      updates.department_id = body.department_id.toLowerCase();
    }
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) { const e = new Error("Invalid status."); e.statusCode = 400; throw e; }
    updates.status = body.status;
  }
  if (body.description !== undefined) updates.description = String(body.description).trim() || null;
  return updates;
}

module.exports = { validateId, validateListQuery, validateCreatePayload, validatePatchPayload };
