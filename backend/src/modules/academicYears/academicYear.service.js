"use strict";

/**
 * academicYear.service.js
 *
 * Business logic layer for Academic Years.
 * Independent of Express req/res.
 */

const { randomUUID } = require("crypto");
const repo = require("./academicYear.repository");
const {
  validateId,
  validateListQuery,
  validateCreatePayload,
  validatePatchPayload,
} = require("./academicYear.validation");

async function getAll(query) {
  const { page, limit, status, search } = validateListQuery(query);
  const { academicYears, total } = await repo.findAll({ page, limit, status, search });
  return {
    academicYears,
    pagination: { page, limit, total, totalPages: total > 0 ? Math.ceil(total / limit) : 0 },
  };
}

async function getById(id) {
  const cleanId = validateId(id);
  const ay = await repo.findById(cleanId);
  if (!ay) {
    const err = new Error("Academic year not found.");
    err.statusCode = 404;
    throw err;
  }
  return ay;
}

async function create(body) {
  const payload = validateCreatePayload(body);

  // Duplicate name check
  const existing = await repo.findByName(payload.year_name);
  if (existing) {
    const err = new Error(`Academic year "${payload.year_name}" already exists.`);
    err.statusCode = 409;
    throw err;
  }

  const id = randomUUID();
  return repo.create({ id, ...payload });
}

async function patch(id, body) {
  const cleanId = validateId(id);
  const updates = validatePatchPayload(body);

  const existing = await repo.findById(cleanId);
  if (!existing) {
    const err = new Error("Academic year not found.");
    err.statusCode = 404;
    throw err;
  }

  // If year_name is being changed, check uniqueness
  if (updates.year_name && updates.year_name !== existing.year_name) {
    const dup = await repo.findByName(updates.year_name);
    if (dup) {
      const err = new Error(`Academic year "${updates.year_name}" already exists.`);
      err.statusCode = 409;
      throw err;
    }
  }

  // Cross-field date validation when only one date is being updated
  const effectiveStart = updates.start_date
    ? new Date(updates.start_date)
    : new Date(existing.start_date);
  const effectiveEnd = updates.end_date
    ? new Date(updates.end_date)
    : new Date(existing.end_date);

  if (effectiveEnd <= effectiveStart) {
    const err = new Error("end_date must be after start_date.");
    err.statusCode = 400;
    throw err;
  }

  return repo.update(cleanId, updates);
}

async function remove(id) {
  const cleanId = validateId(id);

  const existing = await repo.findById(cleanId);
  if (!existing) {
    const err = new Error("Academic year not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countDependents(cleanId);
  if (deps.terms > 0 || deps.enrollments > 0 || deps.assignments > 0 || deps.sessions > 0) {
    const err = new Error(
      `Cannot delete academic year: it has ${deps.terms} term(s), ` +
      `${deps.enrollments} enrollment(s), ${deps.assignments} teacher assignment(s), ` +
      `and ${deps.sessions} attendance session(s).`
    );
    err.statusCode = 409;
    throw err;
  }

  await repo.remove(cleanId);
  return { id: cleanId };
}

module.exports = { getAll, getById, create, patch, remove };
