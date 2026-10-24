"use strict";

const { randomUUID } = require("crypto");
const repo = require("./department.repository");
const { validateId, validateListQuery, validateCreatePayload, validatePatchPayload } = require("./department.validation");

async function getAll(query) {
  const p = validateListQuery(query);
  const { departments, total } = await repo.findAll(p);
  return { departments, pagination: { page: p.page, limit: p.limit, total, totalPages: total > 0 ? Math.ceil(total / p.limit) : 0 } };
}

async function getById(id) {
  const dept = await repo.findById(validateId(id));
  if (!dept) { const e = new Error("Department not found."); e.statusCode = 404; throw e; }
  return dept;
}

async function create(body) {
  const payload = validateCreatePayload(body);
  if (await repo.findByName(payload.department_name)) {
    const e = new Error(`Department name "${payload.department_name}" already exists.`); e.statusCode = 409; throw e;
  }
  if (await repo.findByCode(payload.department_code)) {
    const e = new Error(`Department code "${payload.department_code}" already exists.`); e.statusCode = 409; throw e;
  }
  return repo.create({ id: randomUUID(), ...payload });
}

async function patch(id, body) {
  const cleanId = validateId(id);
  const updates = validatePatchPayload(body);
  const existing = await repo.findById(cleanId);
  if (!existing) { const e = new Error("Department not found."); e.statusCode = 404; throw e; }
  if (updates.department_name && updates.department_name !== existing.department_name) {
    if (await repo.findByName(updates.department_name)) {
      const e = new Error(`Department name "${updates.department_name}" already exists.`); e.statusCode = 409; throw e;
    }
  }
  if (updates.department_code && updates.department_code !== existing.department_code) {
    if (await repo.findByCode(updates.department_code)) {
      const e = new Error(`Department code "${updates.department_code}" already exists.`); e.statusCode = 409; throw e;
    }
  }
  return repo.update(cleanId, updates);
}

async function remove(id) {
  const cleanId = validateId(id);
  const existing = await repo.findById(cleanId);
  if (!existing) { const e = new Error("Department not found."); e.statusCode = 404; throw e; }
  const deps = await repo.countDependents(cleanId);
  // teachers FK is RESTRICT — block deletion
  if (deps.teachers > 0) {
    const e = new Error(`Cannot delete department: ${deps.teachers} teacher(s) belong to it.`); e.statusCode = 409; throw e;
  }
  // courses FK is SET NULL — MySQL will allow but we still protect for business integrity
  if (deps.courses > 0) {
    const e = new Error(`Cannot delete department: ${deps.courses} course(s) reference it.`); e.statusCode = 409; throw e;
  }
  await repo.remove(cleanId);
  return { id: cleanId };
}

module.exports = { getAll, getById, create, patch, remove };
