"use strict";

const crypto = require("crypto");
const repo = require("./teacherAssignment.repository");
const teacherRepo = require("../teachers/teacher.repository");
const subjectRepo = require("../subjects/subject.repository");
const classRepo = require("../classes/class.repository");
const sectionRepo = require("../sections/section.repository");
const ayRepo = require("../academicYears/academicYear.repository");
const termRepo = require("../terms/term.repository");
const {
  validateId,
  validatePagination,
  validateCreate,
  validatePatch,
} = require("./teacherAssignment.validation");

async function getAll(query, requester) {
  const { page, limit } = validatePagination(query);
  let teacher_id = query.teacher_id ? String(query.teacher_id).trim() : null;
  const subject_id = query.subject_id ? String(query.subject_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const term_id = query.term_id ? String(query.term_id).trim() : null;

  if (requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher) {
      const err = new Error("Teacher profile not found.");
      err.statusCode = 404;
      throw err;
    }
    teacher_id = teacher.id;
  }

  const { assignments, total } = await repo.findAll({
    page,
    limit,
    teacher_id,
    subject_id,
    class_id,
    section_id,
    academic_year_id,
    term_id,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    assignments,
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
  const assignment = await repo.findById(id);
  if (!assignment) {
    const err = new Error("Teacher assignment not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "teacher") {
    if (assignment.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only view your own teacher assignments.");
      err.statusCode = 403;
      throw err;
    }
  }

  return assignment;
}

async function create(body) {
  const data = validateCreate(body);

  const teacher = await teacherRepo.findTeacherById(data.teacher_id);
  if (!teacher) {
    const err = new Error("Referenced teacher does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const subject = await subjectRepo.findById(data.subject_id);
  if (!subject) {
    const err = new Error("Referenced subject does not exist.");
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

  const year = await ayRepo.findById(data.academic_year_id);
  if (!year) {
    const err = new Error("Referenced academic year does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const term = await termRepo.findById(data.term_id);
  if (!term) {
    const err = new Error("Referenced term does not exist.");
    err.statusCode = 400;
    throw err;
  }
  if (term.academic_year_id !== data.academic_year_id) {
    const err = new Error("Referenced term does not belong to the selected academic year.");
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await repo.findDuplicate(data);
  if (duplicate) {
    const err = new Error("This exact teacher assignment already exists.");
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
    const err = new Error("Teacher assignment not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatch(body);

  const target = {
    teacher_id: updates.teacher_id || existing.teacher_id,
    subject_id: updates.subject_id || existing.subject_id,
    class_id: updates.class_id || existing.class_id,
    section_id: updates.section_id || existing.section_id,
    academic_year_id: updates.academic_year_id || existing.academic_year_id,
    term_id: updates.term_id || existing.term_id,
  };

  if (updates.teacher_id) {
    const teacher = await teacherRepo.findTeacherById(updates.teacher_id);
    if (!teacher) {
      const err = new Error("Referenced teacher does not exist.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (updates.subject_id) {
    const subject = await subjectRepo.findById(updates.subject_id);
    if (!subject) {
      const err = new Error("Referenced subject does not exist.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (updates.class_id) {
    const cls = await classRepo.findById(updates.class_id);
    if (!cls) {
      const err = new Error("Referenced class does not exist.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (updates.section_id || updates.class_id) {
    const section = await sectionRepo.findById(target.section_id);
    if (!section) {
      const err = new Error("Referenced section does not exist.");
      err.statusCode = 400;
      throw err;
    }
    if (section.class_id !== target.class_id) {
      const err = new Error("Referenced section does not belong to the selected class.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (updates.academic_year_id) {
    const year = await ayRepo.findById(updates.academic_year_id);
    if (!year) {
      const err = new Error("Referenced academic year does not exist.");
      err.statusCode = 400;
      throw err;
    }
  }

  if (updates.term_id || updates.academic_year_id) {
    const term = await termRepo.findById(target.term_id);
    if (!term) {
      const err = new Error("Referenced term does not exist.");
      err.statusCode = 400;
      throw err;
    }
    if (term.academic_year_id !== target.academic_year_id) {
      const err = new Error("Referenced term does not belong to the selected academic year.");
      err.statusCode = 400;
      throw err;
    }
  }

  const duplicate = await repo.findDuplicate(target);
  if (duplicate && duplicate.id !== id) {
    const err = new Error("This exact teacher assignment already exists.");
    err.statusCode = 409;
    throw err;
  }

  return repo.update(id, updates);
}

async function remove(idParam) {
  const id = validateId(idParam);
  const existing = await repo.findById(id);
  if (!existing) {
    const err = new Error("Teacher assignment not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countDependents(id);
  if (deps.sessions > 0) {
    const err = new Error(
      `Cannot delete teacher assignment: referenced by ${deps.sessions} attendance session(s).`
    );
    err.statusCode = 409;
    throw err;
  }

  await repo.remove(id);
  return { message: "Teacher assignment deleted successfully." };
}

module.exports = {
  getAll,
  getById,
  create,
  patch,
  remove,
};
