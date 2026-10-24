"use strict";

/**
 * department.validation.js
 * Schema: id, department_name (UNIQUE), department_code (UNIQUE), description, created_at
 * No status field. No updated_at.
 */

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(v) { return typeof v === "string" && VALID_UUID.test(v); }

function validateId(id) {
  if (!isUUID(id)) { const e = new Error("Invalid department ID."); e.statusCode = 400; throw e; }
  return id.toLowerCase();
}

function validateListQuery(query) {
  let page = parseInt(query.page, 10); let limit = parseInt(query.limit, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) { const e = new Error("limit must not exceed 100."); e.statusCode = 400; throw e; }
  const search = typeof query.search === "string" ? query.search.trim() : null;
  return { page, limit, search };
}

function validateCreatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const e = new Error("Request body must be a JSON object."); e.statusCode = 400; throw e;
  }
  const ALLOWED = new Set(["department_name", "department_code", "description"]);
  for (const k of Object.keys(body)) {
    if (!ALLOWED.has(k)) { const e = new Error(`Unknown field: "${k}".`); e.statusCode = 400; throw e; }
  }
  if (!body.department_name) { const e = new Error('"department_name" is required.'); e.statusCode = 400; throw e; }
  if (!body.department_code) { const e = new Error('"department_code" is required.'); e.statusCode = 400; throw e; }

  const department_name = String(body.department_name).trim();
  const department_code = String(body.department_code).trim().toUpperCase();
  if (!department_name.length || department_name.length > 100) {
    const e = new Error("department_name must be 1–100 chars."); e.statusCode = 400; throw e;
  }
  if (!department_code.length || department_code.length > 20) {
    const e = new Error("department_code must be 1–20 chars."); e.statusCode = 400; throw e;
  }
  const description = body.description !== undefined ? String(body.description).trim() || null : null;
  return { department_name, department_code, description };
}

function validatePatchPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const e = new Error("Request body must be a JSON object."); e.statusCode = 400; throw e;
  }
  const ALLOWED = new Set(["department_name", "department_code", "description"]);
  const FORBIDDEN = new Set(["id", "created_at"]);
  const keys = Object.keys(body);
  if (!keys.length) { const e = new Error("PATCH body must contain at least one field."); e.statusCode = 400; throw e; }
  for (const k of keys) {
    if (FORBIDDEN.has(k)) { const e = new Error(`"${k}" is immutable.`); e.statusCode = 400; throw e; }
    if (!ALLOWED.has(k)) { const e = new Error(`Unknown field: "${k}".`); e.statusCode = 400; throw e; }
  }
  const updates = {};
  if (body.department_name !== undefined) {
    const n = String(body.department_name).trim();
    if (!n.length || n.length > 100) { const e = new Error("department_name must be 1–100 chars."); e.statusCode = 400; throw e; }
    updates.department_name = n;
  }
  if (body.department_code !== undefined) {
    const c = String(body.department_code).trim().toUpperCase();
    if (!c.length || c.length > 20) { const e = new Error("department_code must be 1–20 chars."); e.statusCode = 400; throw e; }
    updates.department_code = c;
  }
  if (body.description !== undefined) updates.description = String(body.description).trim() || null;
  return updates;
}

module.exports = { validateId, validateListQuery, validateCreatePayload, validatePatchPayload };
