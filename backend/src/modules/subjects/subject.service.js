"use strict";

const crypto = require("crypto");
const repo = require("./subject.repository");
const {
  validateId,
  validatePagination,
  validateCreate,
  validatePatch,
} = require("./subject.validation");

async function getAll(query) {
  const { page, limit } = validatePagination(query);
  const status = query.status ? String(query.status).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

  const { subjects, total } = await repo.findAll({ page, limit, status, search });
  const totalPages = Math.ceil(total / limit);

  return {
    subjects,
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
  const subject = await repo.findById(id);
  if (!subject) {
    const err = new Error("Subject not found.");
    err.statusCode = 404;
    throw err;
  }
  return subject;
}

async function create(body) {
  const data = validateCreate(body);

  const existing = await repo.findByCode(data.subject_code);
  if (existing) {
    const err = new Error(`Subject with code '${data.subject_code}' already exists.`);
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
    const err = new Error("Subject not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatch(body);

  if (updates.subject_code && updates.subject_code !== existing.subject_code) {
    const duplicate = await repo.findByCode(updates.subject_code);
    if (duplicate) {
      const err = new Error(`Subject with code '${updates.subject_code}' already exists.`);
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
    const err = new Error("Subject not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countDependents(id);
  const reasons = [];
  if (deps.assignments > 0) reasons.push(`${deps.assignments} teacher assignment(s)`);
  if (deps.examSubjects > 0) reasons.push(`${deps.examSubjects} exam subject(s)`);

  if (reasons.length > 0) {
    const err = new Error(
      `Cannot delete subject '${existing.subject_name}': referenced by ${reasons.join(", ")}.`
    );
    err.statusCode = 409;
    throw err;
  }

  await repo.remove(id);
  return { message: `Subject '${existing.subject_name}' deleted successfully.` };
}

module.exports = {
  getAll,
  getById,
  create,
  patch,
  remove,
};
