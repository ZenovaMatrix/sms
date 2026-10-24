"use strict";

const { randomUUID } = require("crypto");
const repo = require("./course.repository");
const deptRepo = require("../departments/department.repository");
const { validateId, validateListQuery, validateCreatePayload, validatePatchPayload } = require("./course.validation");

async function getAll(query) {
  const p = validateListQuery(query);
  const { courses, total } = await repo.findAll(p);
  return { courses, pagination: { page: p.page, limit: p.limit, total, totalPages: total > 0 ? Math.ceil(total / p.limit) : 0 } };
}

async function getById(id) {
  const course = await repo.findById(validateId(id));
  if (!course) { const e = new Error("Course not found."); e.statusCode = 404; throw e; }
  return course;
}

async function create(body) {
  const payload = validateCreatePayload(body);
  if (payload.department_id) {
    const dept = await deptRepo.findById(payload.department_id);
    if (!dept) { const e = new Error("Department not found."); e.statusCode = 404; throw e; }
  }
  if (await repo.findByCode(payload.course_code)) {
    const e = new Error(`Course code "${payload.course_code}" already exists.`); e.statusCode = 409; throw e;
  }
  return repo.create({ id: randomUUID(), ...payload });
}

async function patch(id, body) {
  const cleanId = validateId(id);
  const updates = validatePatchPayload(body);
  const existing = await repo.findById(cleanId);
  if (!existing) { const e = new Error("Course not found."); e.statusCode = 404; throw e; }
  if (updates.department_id !== undefined && updates.department_id !== null) {
    const dept = await deptRepo.findById(updates.department_id);
    if (!dept) { const e = new Error("Department not found."); e.statusCode = 404; throw e; }
  }
  if (updates.course_code && updates.course_code !== existing.course_code) {
    if (await repo.findByCode(updates.course_code)) {
      const e = new Error(`Course code "${updates.course_code}" already exists.`); e.statusCode = 409; throw e;
    }
  }
  return repo.update(cleanId, updates);
}

async function remove(id) {
  const cleanId = validateId(id);
  const existing = await repo.findById(cleanId);
  if (!existing) { const e = new Error("Course not found."); e.statusCode = 404; throw e; }
  const deps = await repo.countDependents(cleanId);
  if (deps.enrollments > 0) {
    const e = new Error(`Cannot delete course: ${deps.enrollments} enrollment(s) reference it.`); e.statusCode = 409; throw e;
  }
  await repo.remove(cleanId);
  return { id: cleanId };
}

module.exports = { getAll, getById, create, patch, remove };
