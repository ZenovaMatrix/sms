"use strict";

const crypto = require("crypto");
const pool = require("../../config/db");
const repo = require("./enrollment.repository");
const studentRepo = require("../students/student.repository");
const classRepo = require("../classes/class.repository");
const sectionRepo = require("../sections/section.repository");
const ayRepo = require("../academicYears/academicYear.repository");
const courseRepo = require("../courses/course.repository");
const {
  validateId,
  validatePagination,
  validateCreate,
  validatePatch,
} = require("./enrollment.validation");

async function isParentLinkedToStudent(parentUserId, studentId) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM student_parents sp
     JOIN parents_guardians pg ON pg.id = sp.parent_id
     WHERE pg.user_id = ? AND sp.student_id = ?`,
    [parentUserId, studentId]
  );
  return rows.length > 0;
}

async function getAll(query, requester) {
  const { page, limit } = validatePagination(query);
  let student_id = query.student_id ? String(query.student_id).trim() : null;
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const status = query.status ? String(query.status).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

  if (requester.role === "student") {
    const student = await studentRepo.findStudentByUserId(requester.userId);
    if (!student) {
      const err = new Error("Student profile not found.");
      err.statusCode = 404;
      throw err;
    }
    student_id = student.id;
  } else if (requester.role === "parent") {
    if (student_id) {
      const linked = await isParentLinkedToStudent(requester.userId, student_id);
      if (!linked) {
        const err = new Error("Forbidden: student is not linked to your parent account.");
        err.statusCode = 403;
        throw err;
      }
    } else {
      // Find all linked students for parent
      const [links] = await pool.execute(
        `SELECT sp.student_id FROM student_parents sp
         JOIN parents_guardians pg ON pg.id = sp.parent_id
         WHERE pg.user_id = ?`,
        [requester.userId]
      );
      if (links.length === 0) {
        return {
          enrollments: [],
          pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        };
      }
      // If parent has exactly 1 linked student and no filter supplied, default to it
      if (links.length === 1) {
        student_id = links[0].student_id;
      }
    }
  }

  const { enrollments, total } = await repo.findAll({
    page,
    limit,
    student_id,
    academic_year_id,
    class_id,
    section_id,
    status,
    search,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    enrollments,
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

async function getById(idParam, requester) {
  const id = validateId(idParam);
  const enrollment = await repo.findById(id);
  if (!enrollment) {
    const err = new Error("Enrollment not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "student") {
    if (enrollment.student_user_id !== requester.userId) {
      const err = new Error("Forbidden: you can only view your own enrollment.");
      err.statusCode = 403;
      throw err;
    }
  } else if (requester.role === "parent") {
    const linked = await isParentLinkedToStudent(requester.userId, enrollment.student_id);
    if (!linked) {
      const err = new Error("Forbidden: enrollment does not belong to a linked student.");
      err.statusCode = 403;
      throw err;
    }
  }

  return enrollment;
}

async function create(body) {
  const data = validateCreate(body);

  const student = await studentRepo.findStudentById(data.student_id);
  if (!student) {
    const err = new Error("Referenced student does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const year = await ayRepo.findById(data.academic_year_id);
  if (!year) {
    const err = new Error("Referenced academic year does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const cls = await classRepo.findById(data.class_id);
  if (!cls) {
    const err = new Error("Referenced class does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const section = await sectionRepo.findById(data.section_id);
  if (!section) {
    const err = new Error("Referenced section does not exist.");
    err.statusCode = 400;
    throw err;
  }

  if (section.class_id !== data.class_id) {
    const err = new Error("Referenced section does not belong to the selected class.");
    err.statusCode = 400;
    throw err;
  }

  if (data.course_id) {
    const course = await courseRepo.findById(data.course_id);
    if (!course) {
      const err = new Error("Referenced course does not exist.");
      err.statusCode = 400;
      throw err;
    }
  }

  const duplicate = await repo.findByStudentAndYear(data.student_id, data.academic_year_id);
  if (duplicate) {
    const err = new Error("Student is already enrolled in this academic year.");
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
    const err = new Error("Enrollment not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatch(body);

  const targetClassId = updates.class_id || existing.class_id;
  const targetSectionId = updates.section_id || existing.section_id;

  if (updates.class_id) {
    const cls = await classRepo.findById(updates.class_id);
    if (!cls) {
      const err = new Error("Referenced class does not exist.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (updates.section_id) {
    const section = await sectionRepo.findById(updates.section_id);
    if (!section) {
      const err = new Error("Referenced section does not exist.");
      err.statusCode = 400;
      throw err;
    }
    if (section.class_id !== targetClassId) {
      const err = new Error("Referenced section does not belong to the selected class.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (updates.course_id) {
    const course = await courseRepo.findById(updates.course_id);
    if (!course) {
      const err = new Error("Referenced course does not exist.");
      err.statusCode = 400;
      throw err;
    }
  }

  return repo.update(id, updates);
}

async function remove(idParam) {
  const id = validateId(idParam);
  const existing = await repo.findById(id);
  if (!existing) {
    const err = new Error("Enrollment not found.");
    err.statusCode = 404;
    throw err;
  }

  await repo.remove(id);
  return { message: "Enrollment deleted successfully." };
}

module.exports = {
  getAll,
  getById,
  create,
  patch,
  remove,
};
