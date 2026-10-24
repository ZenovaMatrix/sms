"use strict";

const crypto = require("crypto");
const repo = require("./class.repository");
const {
  validateId,
  validatePagination,
  validateCreate,
  validatePatch,
} = require("./class.validation");

async function getAll(query) {
  const { page, limit } = validatePagination(query);
  const search = query.search ? String(query.search).trim() : null;

  const { classes, total } = await repo.findAll({ page, limit, search });
  const totalPages = Math.ceil(total / limit);

  return {
    classes,
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
  const cls = await repo.findById(id);
  if (!cls) {
    const err = new Error("Class not found.");
    err.statusCode = 404;
    throw err;
  }
  return cls;
}

async function create(body) {
  const data = validateCreate(body);

  const existing = await repo.findByName(data.class_name);
  if (existing) {
    const err = new Error(`Class '${data.class_name}' already exists.`);
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
    const err = new Error("Class not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatch(body);

  if (updates.class_name && updates.class_name !== existing.class_name) {
    const duplicate = await repo.findByName(updates.class_name);
    if (duplicate) {
      const err = new Error(`Class '${updates.class_name}' already exists.`);
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
    const err = new Error("Class not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countDependents(id);
  const reasons = [];
  if (deps.sections > 0) reasons.push(`${deps.sections} section(s)`);
  if (deps.enrollments > 0) reasons.push(`${deps.enrollments} enrollment(s)`);
  if (deps.assignments > 0) reasons.push(`${deps.assignments} teacher assignment(s)`);
  if (deps.exams > 0) reasons.push(`${deps.exams} exam(s)`);
  if (deps.fees > 0) reasons.push(`${deps.fees} fee structure(s)`);

  if (reasons.length > 0) {
    const err = new Error(
      `Cannot delete class '${existing.class_name}': referenced by ${reasons.join(", ")}.`
    );
    err.statusCode = 409;
    throw err;
  }

  await repo.remove(id);
  return { message: `Class '${existing.class_name}' deleted successfully.` };
}

module.exports = {
  getAll,
  getById,
  create,
  patch,
  remove,
};
