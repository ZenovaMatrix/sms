"use strict";

const { randomUUID } = require("crypto");
const repo = require("./term.repository");
const ayRepo = require("../academicYears/academicYear.repository");
const { validateId, validateListQuery, validateCreatePayload, validatePatchPayload } = require("./term.validation");

async function getAll(query) {
  const params = validateListQuery(query);
  const { terms, total } = await repo.findAll(params);
  return { terms, pagination: { page: params.page, limit: params.limit, total, totalPages: total > 0 ? Math.ceil(total / params.limit) : 0 } };
}

async function getById(id) {
  const cleanId = validateId(id);
  const term = await repo.findById(cleanId);
  if (!term) { const e = new Error("Term not found."); e.statusCode = 404; throw e; }
  return term;
}

async function create(body) {
  const payload = validateCreatePayload(body);

  // Validate academic year exists
  const ay = await ayRepo.findById(payload.academic_year_id);
  if (!ay) { const e = new Error("Academic year not found."); e.statusCode = 404; throw e; }

  // Validate term dates fall within academic year
  const ayStart = new Date(ay.start_date);
  const ayEnd = new Date(ay.end_date);
  const tStart = new Date(payload.start_date);
  const tEnd = new Date(payload.end_date);
  if (tStart < ayStart || tEnd > ayEnd) {
    const e = new Error("Term dates must fall within the academic year date range.");
    e.statusCode = 400; throw e;
  }

  // Duplicate check (unique per academic_year + term_name)
  const existing = await repo.findByYearAndName(payload.academic_year_id, payload.term_name);
  if (existing) {
    const e = new Error(`Term "${payload.term_name}" already exists in this academic year.`);
    e.statusCode = 409; throw e;
  }

  return repo.create({ id: randomUUID(), ...payload });
}

async function patch(id, body) {
  const cleanId = validateId(id);
  const updates = validatePatchPayload(body);

  const existing = await repo.findById(cleanId);
  if (!existing) { const e = new Error("Term not found."); e.statusCode = 404; throw e; }

  // Name uniqueness check
  if (updates.term_name && updates.term_name !== existing.term_name) {
    const dup = await repo.findByYearAndName(existing.academic_year_id, updates.term_name);
    if (dup) { const e = new Error(`Term "${updates.term_name}" already exists in this academic year.`); e.statusCode = 409; throw e; }
  }

  // Cross-field date validation
  const effectiveStart = updates.start_date ? new Date(updates.start_date) : new Date(existing.start_date);
  const effectiveEnd = updates.end_date ? new Date(updates.end_date) : new Date(existing.end_date);
  if (effectiveEnd <= effectiveStart) { const e = new Error("end_date must be after start_date."); e.statusCode = 400; throw e; }

  return repo.update(cleanId, updates);
}

async function remove(id) {
  const cleanId = validateId(id);
  const existing = await repo.findById(cleanId);
  if (!existing) { const e = new Error("Term not found."); e.statusCode = 404; throw e; }

  const deps = await repo.countDependents(cleanId);
  if (deps.assignments > 0) {
    const e = new Error(`Cannot delete term: ${deps.assignments} teacher assignment(s) depend on it.`);
    e.statusCode = 409; throw e;
  }

  await repo.remove(cleanId);
  return { id: cleanId };
}

module.exports = { getAll, getById, create, patch, remove };
