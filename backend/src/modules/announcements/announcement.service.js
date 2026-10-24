"use strict";

/**
 * announcement.service.js
 *
 * Business logic layer for Announcements module.
 */

const crypto = require("crypto");
const pool = require("../../config/db");
const repo = require("./announcement.repository");
const studentRepo = require("../students/student.repository");
const teacherRepo = require("../teachers/teacher.repository");
const {
  validateId,
  validatePagination,
  validateCreatePayload,
  validatePatchPayload,
} = require("./announcement.validation");

async function getAll(query, requester) {
  const { page, limit } = validatePagination(query);
  const status = query.status ? String(query.status).trim() : null;
  const target_type = query.target_type ? String(query.target_type).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

  let audienceClassId = null;
  let audienceSectionId = null;

  if (requester.role === "student") {
    const student = await studentRepo.findStudentByUserId(requester.userId);
    if (student) {
      // Find active enrollment
      const [enrollments] = await pool.execute(
        `SELECT class_id, section_id FROM enrollments WHERE student_id = ? AND status = 'active' LIMIT 1`,
        [student.id]
      );
      if (enrollments.length > 0) {
        audienceClassId = enrollments[0].class_id;
        audienceSectionId = enrollments[0].section_id;
      }
    }
  } else if (requester.role === "parent") {
    const [links] = await pool.execute(
      `SELECT e.class_id, e.section_id
       FROM student_parents sp
       JOIN parents_guardians pg ON pg.id = sp.parent_id
       JOIN enrollments e ON e.student_id = sp.student_id AND e.status = 'active'
       WHERE pg.user_id = ? LIMIT 1`,
      [requester.userId]
    );
    if (links.length > 0) {
      audienceClassId = links[0].class_id;
      audienceSectionId = links[0].section_id;
    }
  }

  const { announcements, total } = await repo.findAll({
    page,
    limit,
    status: requester.role === "admin" ? status : "published",
    target_type,
    class_id,
    section_id,
    search,
    audienceRole: requester.role,
    audienceClassId,
    audienceSectionId,
  });

  const totalPages = Math.ceil(total / limit) || (total > 0 ? 1 : 0);

  return {
    announcements,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

async function getById(idParam) {
  const id = validateId(idParam);
  const item = await repo.findById(id);
  if (!item) {
    const err = new Error("Announcement not found.");
    err.statusCode = 404;
    throw err;
  }
  return item;
}

async function create(body, requester) {
  const payload = validateCreatePayload(body);
  const id = crypto.randomUUID();

  return repo.create({
    id,
    created_by: requester.userId,
    ...payload,
  });
}

async function patch(idParam, body) {
  const id = validateId(idParam);
  const existing = await repo.findById(id);
  if (!existing) {
    const err = new Error("Announcement not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatchPayload(body);
  return repo.update(id, updates);
}

async function remove(idParam) {
  const id = validateId(idParam);
  const existing = await repo.findById(id);
  if (!existing) {
    const err = new Error("Announcement not found.");
    err.statusCode = 404;
    throw err;
  }

  return repo.remove(id);
}

module.exports = {
  getAll,
  getById,
  create,
  patch,
  remove,
};
