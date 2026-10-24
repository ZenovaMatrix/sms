"use strict";

const crypto = require("crypto");
const repo = require("./section.repository");
const classRepo = require("../classes/class.repository");
const {
  validateId,
  validatePagination,
  validateCreate,
  validatePatch,
} = require("./section.validation");

async function getAll(query) {
  const { page, limit } = validatePagination(query);
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

  const { sections, total } = await repo.findAll({ page, limit, class_id, search });
  const totalPages = Math.ceil(total / limit);

  return {
    sections,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

async function getById(idParam) {
  const id = validateId(idParam);
  const section = await repo.findById(id);
  if (!section) {
    const err = new Error("Section not found.");
    err.statusCode = 404;
    throw err;
  }
  return section;
}

async function create(body) {
  const data = validateCreate(body);

  const parentClass = await classRepo.findById(data.class_id);
  if (!parentClass) {
    const err = new Error("Referenced class does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await repo.findByClassAndName(data.class_id, data.section_name);
  if (duplicate) {
    const err = new Error(
      `Section '${data.section_name}' already exists for class '${parentClass.class_name}'.`
    );
    err.statusCode = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  return repo.create({ id, ...data });
}

async function patch(idParam, body) {
  const id = validateId(idParam);
  const existing = await repo.findById(id);
  if (!existing) {
    const err = new Error("Section not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatch(body);

  const targetClassId = updates.class_id || existing.class_id;
  const targetSectionName = updates.section_name || existing.section_name;

  if (updates.class_id && updates.class_id !== existing.class_id) {
    const parentClass = await classRepo.findById(updates.class_id);
    if (!parentClass) {
      const err = new Error("Referenced class does not exist.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (
    (updates.class_id && updates.class_id !== existing.class_id) ||
    (updates.section_name && updates.section_name !== existing.section_name)
  ) {
    const duplicate = await repo.findByClassAndName(targetClassId, targetSectionName);
    if (duplicate && duplicate.id !== id) {
      const err = new Error(
        `Section '${targetSectionName}' already exists for this class.`
      );
      err.statusCode = 409;
      throw err;
    }
  }

  return repo.update(id, updates);
}

async function remove(idParam) {
  const id = validateId(idParam);
  const existing = await repo.findById(id);
  if (!existing) {
    const err = new Error("Section not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countDependents(id);
  const reasons = [];
  if (deps.enrollments > 0) reasons.push(`${deps.enrollments} enrollment(s)`);
  if (deps.assignments > 0) reasons.push(`${deps.assignments} teacher assignment(s)`);

  if (reasons.length > 0) {
    const err = new Error(
      `Cannot delete section '${existing.section_name}': referenced by ${reasons.join(", ")}.`
    );
    err.statusCode = 409;
    throw err;
  }

  await repo.remove(id);
  return { message: `Section '${existing.section_name}' deleted successfully.` };
}

module.exports = {
  getAll,
  getById,
  create,
  patch,
  remove,
};
