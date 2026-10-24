"use strict";

/**
 * academicYear.validation.js
 *
 * Pure validation helpers for the Academic Years module.
 * No DB access. No Express req/res.
 *
 * Actual schema (confirmed via SHOW CREATE TABLE):
 *   id          char(36) NOT NULL
 *   year_name   varchar(20) NOT NULL  UNIQUE
 *   start_date  date NOT NULL
 *   end_date    date NOT NULL
 *   status      enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming'
 *   CHECK (end_date > start_date)
 */

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ["upcoming", "active", "completed"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidUUID(v) {
  return typeof v === "string" && VALID_UUID.test(v);
}

function isValidDateString(v) {
  if (typeof v !== "string" || !DATE_REGEX.test(v)) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

/**
 * Validate and normalise the :id route parameter.
 */
function validateId(id) {
  if (!isValidUUID(id)) {
    const err = new Error("Invalid academic year ID. Must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return id.toLowerCase();
}

/**
 * Validate query parameters for GET /academic-years.
 */
function validateListQuery(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) {
    const err = new Error("limit must not exceed 100.");
    err.statusCode = 400;
    throw err;
  }

  let status = null;
  if (query.status !== undefined) {
    if (!VALID_STATUSES.includes(query.status)) {
      const err = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    status = query.status;
  }

  const search = typeof query.search === "string" ? query.search.trim() : null;

  return { page, limit, status, search };
}

/**
 * Validate POST body for creating an academic year.
 */
function validateCreatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const ALLOWED = new Set(["year_name", "start_date", "end_date", "status"]);
  const REQUIRED = ["year_name", "start_date", "end_date"];

  // Reject unknown fields
  for (const key of Object.keys(body)) {
    if (!ALLOWED.has(key)) {
      const err = new Error(`Unknown field: "${key}". Allowed: ${[...ALLOWED].join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Required fields
  for (const field of REQUIRED) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      const err = new Error(`"${field}" is required.`);
      err.statusCode = 400;
      throw err;
    }
  }

  // year_name
  const year_name = String(body.year_name).trim();
  if (year_name.length === 0 || year_name.length > 20) {
    const err = new Error("year_name must be between 1 and 20 characters.");
    err.statusCode = 400;
    throw err;
  }

  // Dates
  if (!isValidDateString(body.start_date)) {
    const err = new Error("start_date must be a valid date in YYYY-MM-DD format.");
    err.statusCode = 400;
    throw err;
  }
  if (!isValidDateString(body.end_date)) {
    const err = new Error("end_date must be a valid date in YYYY-MM-DD format.");
    err.statusCode = 400;
    throw err;
  }

  const start = new Date(body.start_date);
  const end = new Date(body.end_date);
  if (end <= start) {
    const err = new Error("end_date must be after start_date.");
    err.statusCode = 400;
    throw err;
  }

  // Status
  let status = "upcoming";
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      const err = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    status = body.status;
  }

  return {
    year_name,
    start_date: body.start_date,
    end_date: body.end_date,
    status,
  };
}

/**
 * Validate PATCH body for updating an academic year.
 */
function validatePatchPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const ALLOWED = new Set(["year_name", "start_date", "end_date", "status"]);
  const FORBIDDEN = new Set(["id"]);

  const keys = Object.keys(body);
  if (keys.length === 0) {
    const err = new Error("PATCH body must contain at least one field to update.");
    err.statusCode = 400;
    throw err;
  }

  for (const key of keys) {
    if (FORBIDDEN.has(key)) {
      const err = new Error(`"${key}" is immutable and cannot be updated.`);
      err.statusCode = 400;
      throw err;
    }
    if (!ALLOWED.has(key)) {
      const err = new Error(`Unknown field: "${key}". Allowed: ${[...ALLOWED].join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
  }

  const updates = {};

  if (body.year_name !== undefined) {
    const year_name = String(body.year_name).trim();
    if (year_name.length === 0 || year_name.length > 20) {
      const err = new Error("year_name must be between 1 and 20 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.year_name = year_name;
  }

  if (body.start_date !== undefined) {
    if (!isValidDateString(body.start_date)) {
      const err = new Error("start_date must be a valid date in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    updates.start_date = body.start_date;
  }

  if (body.end_date !== undefined) {
    if (!isValidDateString(body.end_date)) {
      const err = new Error("end_date must be a valid date in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    updates.end_date = body.end_date;
  }

  // Cross-field date validation if both are provided
  if (updates.start_date && updates.end_date) {
    if (new Date(updates.end_date) <= new Date(updates.start_date)) {
      const err = new Error("end_date must be after start_date.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      const err = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    updates.status = body.status;
  }

  return updates;
}

module.exports = {
  validateId,
  validateListQuery,
  validateCreatePayload,
  validatePatchPayload,
};
