"use strict";

const crypto = require("crypto");
const pool = require("../../config/db");
const repo = require("./examination.repository");
const studentRepo = require("../students/student.repository");
const classRepo = require("../classes/class.repository");
const ayRepo = require("../academicYears/academicYear.repository");
const termRepo = require("../terms/term.repository");
const subjectRepo = require("../subjects/subject.repository");
const teacherRepo = require("../teachers/teacher.repository");
const deadlineService = require("../deadlines/deadline.service");
const auditRepo = require("../audit/audit.repository");
const {
  validateId,
  validatePagination,
  validateCreateExam,
  validatePatchExam,
  validateCreateExamSubject,
  validatePatchExamSubject,
  validateCreateResult,
  validatePatchResult,
} = require("./examination.validation");

async function isParentLinkedToStudent(parentUserId, studentId) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM student_parents sp
     JOIN parents_guardians pg ON pg.id = sp.parent_id
     WHERE pg.user_id = ? AND sp.student_id = ?`,
    [parentUserId, studentId]
  );
  return rows.length > 0;
}

function calculateGrade(marks, total, passing) {
  const pct = (marks / total) * 100;
  let grade = "F";
  if (pct >= 90) grade = "A+";
  else if (pct >= 80) grade = "A";
  else if (pct >= 70) grade = "B";
  else if (pct >= 60) grade = "C";
  else if (pct >= 50) grade = "D";

  const status = marks >= passing ? "pass" : "fail";
  return { grade, status };
}

// ─── EXAMINATIONS ─────────────────────────────────────────────────────────────

async function getAllExams(query) {
  const { page, limit } = validatePagination(query);
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const term_id = query.term_id ? String(query.term_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const status = query.status ? String(query.status).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

  const { examinations, total } = await repo.findAllExams({
    page,
    limit,
    academic_year_id,
    term_id,
    class_id,
    status,
    search,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    examinations,
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

async function getExamById(idParam) {
  const id = validateId(idParam);
  const exam = await repo.findExamById(id);
  if (!exam) {
    const err = new Error("Examination not found.");
    err.statusCode = 404;
    throw err;
  }
  return exam;
}

async function createExam(body) {
  const data = validateCreateExam(body);

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

  const cls = await classRepo.findById(data.class_id);
  if (!cls) {
    const err = new Error("Referenced class does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const id = crypto.randomUUID();
  return repo.createExam({ id, ...data });
}

async function patchExam(idParam, body) {
  const id = validateId(idParam);
  const existing = await repo.findExamById(id);
  if (!existing) {
    const err = new Error("Examination not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatchExam(body);
  const effectiveStart = updates.start_date !== undefined ? updates.start_date : existing.start_date;
  const effectiveEnd = updates.end_date !== undefined ? updates.end_date : existing.end_date;

  if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
    const err = new Error("end_date cannot precede start_date.");
    err.statusCode = 400;
    throw err;
  }

  return repo.updateExam(id, updates);
}

async function removeExam(idParam) {
  const id = validateId(idParam);
  const existing = await repo.findExamById(id);
  if (!existing) {
    const err = new Error("Examination not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countExamDependents(id);
  if (deps.subjects > 0) {
    const err = new Error(`Cannot delete examination: referenced by ${deps.subjects} exam subject(s).`);
    err.statusCode = 409;
    throw err;
  }

  await repo.removeExam(id);
  return { message: "Examination deleted successfully." };
}

// ─── EXAM SUBJECTS ────────────────────────────────────────────────────────────

async function getAllExamSubjects(query) {
  const exam_id = query.exam_id ? String(query.exam_id).trim() : null;
  const subject_id = query.subject_id ? String(query.subject_id).trim() : null;

  const examSubjects = await repo.findAllExamSubjects({ exam_id, subject_id });
  return { examSubjects };
}

async function getExamSubjectById(idParam) {
  const id = validateId(idParam);
  const es = await repo.findExamSubjectById(id);
  if (!es) {
    const err = new Error("Exam subject not found.");
    err.statusCode = 404;
    throw err;
  }
  return es;
}

async function createExamSubject(body) {
  const data = validateCreateExamSubject(body);

  const exam = await repo.findExamById(data.exam_id);
  if (!exam) {
    const err = new Error("Referenced examination does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const subject = await subjectRepo.findById(data.subject_id);
  if (!subject) {
    const err = new Error("Referenced subject does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await repo.findDuplicateExamSubject(data.exam_id, data.subject_id);
  if (duplicate) {
    const err = new Error("This subject is already configured for this examination.");
    err.statusCode = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  return repo.createExamSubject({ id, ...data });
}

async function patchExamSubject(idParam, body) {
  const id = validateId(idParam);
  const existing = await repo.findExamSubjectById(id);
  if (!existing) {
    const err = new Error("Exam subject not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatchExamSubject(body);
  const targetTotal = updates.total_marks !== undefined ? updates.total_marks : Number(existing.total_marks);
  const targetPassing = updates.passing_marks !== undefined ? updates.passing_marks : Number(existing.passing_marks);

  if (targetPassing > targetTotal) {
    const err = new Error("passing_marks cannot exceed total_marks.");
    err.statusCode = 400;
    throw err;
  }

  return repo.updateExamSubject(id, updates);
}

async function removeExamSubject(idParam) {
  const id = validateId(idParam);
  const existing = await repo.findExamSubjectById(id);
  if (!existing) {
    const err = new Error("Exam subject not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countExamSubjectDependents(id);
  if (deps.results > 0) {
    const err = new Error(`Cannot delete exam subject: referenced by ${deps.results} result record(s).`);
    err.statusCode = 409;
    throw err;
  }

  await repo.removeExamSubject(id);
  return { message: "Exam subject deleted successfully." };
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────

async function getAllResults(query, requester) {
  const { page, limit } = validatePagination(query);
  let student_id = query.student_id ? String(query.student_id).trim() : null;
  const exam_id = (query.exam_id || query.examination_id) ? String(query.exam_id || query.examination_id).trim() : null;
  const exam_subject_id = query.exam_subject_id ? String(query.exam_subject_id).trim() : null;
  const subject_id = query.subject_id ? String(query.subject_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const result_status = query.result_status ? String(query.result_status).trim() : null;
  const search = query.search ? String(query.search).trim() : null;
  let teacher_id = null;

  if (requester.role === "student") {
    const student = await studentRepo.findStudentByUserId(requester.userId);
    if (!student) {
      const err = new Error("Student profile not found.");
      err.statusCode = 404;
      throw err;
    }
    student_id = student.id;
  } else if (requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (teacher) {
      teacher_id = teacher.id;
    }
  } else if (requester.role === "parent") {
    if (student_id) {
      const linked = await isParentLinkedToStudent(requester.userId, student_id);
      if (!linked) {
        const err = new Error("Forbidden: student is not linked to your parent account.");
        err.statusCode = 403;
        throw err;
      }
    } else {
      const [links] = await pool.execute(
        `SELECT sp.student_id FROM student_parents sp
         JOIN parents_guardians pg ON pg.id = sp.parent_id
         WHERE pg.user_id = ?`,
        [requester.userId]
      );
      if (links.length === 0) {
        return { results: [], pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
      }
      if (links.length === 1) {
        student_id = links[0].student_id;
      }
    }
  }

  const { results, total } = await repo.findAllResults({
    page,
    limit,
    student_id,
    exam_id,
    exam_subject_id,
    subject_id,
    class_id,
    academic_year_id,
    section_id,
    result_status,
    teacher_id,
    search,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    results,
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

async function getResultById(idParam, requester) {
  const id = validateId(idParam);
  const result = await repo.findResultById(id);
  if (!result) {
    const err = new Error("Result record not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "student") {
    if (result.student_user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only view your own result.");
      err.statusCode = 403;
      throw err;
    }
  } else if (requester.role === "parent") {
    const linked = await isParentLinkedToStudent(requester.userId, result.student_id);
    if (!linked) {
      const err = new Error("Forbidden: result does not belong to a linked student.");
      err.statusCode = 403;
      throw err;
    }
  }

  return result;
}

async function createResult(body, requester = { role: "admin" }) {
  const data = validateCreateResult(body);

  const student = await studentRepo.findStudentById(data.student_id);
  if (!student) {
    const err = new Error("Referenced student does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const es = await repo.findExamSubjectById(data.exam_subject_id);
  if (!es) {
    const err = new Error("Referenced exam subject does not exist.");
    err.statusCode = 400;
    throw err;
  }

  if (requester && requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher) {
      const err = new Error("Teacher profile not found.");
      err.statusCode = 404;
      throw err;
    }
    const [assigned] = await pool.execute(
      `SELECT 1 FROM teacher_assignments ta
       JOIN exam_subjects es ON es.subject_id = ta.subject_id
       JOIN examinations ex ON ex.class_id = ta.class_id AND ex.id = es.exam_id
       WHERE ta.teacher_id = ? AND es.id = ?`,
      [teacher.id, data.exam_subject_id]
    );
    if (assigned.length === 0) {
      const err = new Error("Forbidden: you are not assigned to teach this class or subject.");
      err.statusCode = 403;
      throw err;
    }
    const exam = await repo.findExamById(es.exam_id);
    const window = await deadlineService.checkGradingWindow(exam ? exam.end_date : null);
    if (!window.isOpen) {
      const err = new Error(`Forbidden: Grading window has closed (${window.reason}). Please submit a Correction Request for admin approval.`);
      err.statusCode = 403;
      throw err;
    }
  }

  if (data.marks_obtained > Number(es.total_marks)) {
    const err = new Error(`marks_obtained (${data.marks_obtained}) cannot exceed total marks (${es.total_marks}).`);
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await repo.findDuplicateResult(data.student_id, data.exam_subject_id);
  if (duplicate) {
    const err = new Error("A result record for this student and exam subject already exists.");
    err.statusCode = 409;
    throw err;
  }

  if (!data.grade || !data.result_status) {
    const computed = calculateGrade(data.marks_obtained, Number(es.total_marks), Number(es.passing_marks));
    if (!data.grade) data.grade = computed.grade;
    if (!data.result_status) data.result_status = computed.status;
  }

  const id = crypto.randomUUID();
  const created = await repo.createResult({ id, ...data });

  if (requester && requester.userId) {
    await auditRepo.createAuditLog({
      entity_type: "results",
      entity_id: id,
      action: "CREATE_RESULT",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.name || requester.email,
      new_values: created,
      reason: `Entered result marks: ${data.marks_obtained}`,
    });
  }

  return created;
}

async function patchResult(idParam, body, requester = { role: "admin" }) {
  const id = validateId(idParam);
  const existing = await repo.findResultById(id);
  if (!existing) {
    const err = new Error("Result record not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester && requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher) {
      const err = new Error("Teacher profile not found.");
      err.statusCode = 404;
      throw err;
    }
    const [assigned] = await pool.execute(
      `SELECT 1 FROM teacher_assignments ta
       JOIN exam_subjects es ON es.subject_id = ta.subject_id
       JOIN examinations ex ON ex.class_id = ta.class_id AND ex.id = es.exam_id
       WHERE ta.teacher_id = ? AND es.id = ?`,
      [teacher.id, existing.exam_subject_id]
    );
    if (assigned.length === 0) {
      const err = new Error("Forbidden: you are not assigned to teach this class or subject.");
      err.statusCode = 403;
      throw err;
    }
    const exam = await repo.findExamById(existing.exam_id);
    const window = await deadlineService.checkGradingWindow(exam ? exam.end_date : null);
    if (!window.isOpen) {
      const err = new Error(`Forbidden: Grading window has closed (${window.reason}). Please submit a Correction Request for admin approval.`);
      err.statusCode = 403;
      throw err;
    }
  }

  const updates = validatePatchResult(body);

  if (updates.marks_obtained !== undefined) {
    if (updates.marks_obtained > Number(existing.total_marks)) {
      const err = new Error(`marks_obtained cannot exceed total marks (${existing.total_marks}).`);
      err.statusCode = 400;
      throw err;
    }
    if (updates.grade === undefined && updates.result_status === undefined) {
      const computed = calculateGrade(updates.marks_obtained, Number(existing.total_marks), Number(existing.passing_marks));
      updates.grade = computed.grade;
      updates.result_status = computed.status;
    }
  }

  const updated = await repo.updateResult(id, updates);

  if (requester && requester.userId) {
    await auditRepo.createAuditLog({
      entity_type: "results",
      entity_id: id,
      action: "UPDATE_RESULT",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.name || requester.email,
      old_values: { marks_obtained: existing.marks_obtained, grade: existing.grade, status: existing.result_status },
      new_values: updates,
      reason: "Updated result marks",
    });
  }

  return updated;
}

async function createBulkResults(body, requester = { role: "admin" }) {
  const { exam_subject_id, records } = body;
  if (!exam_subject_id) {
    const err = new Error("exam_subject_id is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!Array.isArray(records) || records.length === 0) {
    const err = new Error("records must be a non-empty array.");
    err.statusCode = 400;
    throw err;
  }

  const es = await repo.findExamSubjectById(exam_subject_id);
  if (!es) {
    const err = new Error("Referenced exam subject does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const exam = await repo.findExamById(es.exam_id);

  if (requester && requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher) {
      const err = new Error("Teacher profile not found.");
      err.statusCode = 404;
      throw err;
    }
    const [assigned] = await pool.execute(
      `SELECT 1 FROM teacher_assignments ta
       JOIN examinations ex ON ex.class_id = ta.class_id
       WHERE ta.teacher_id = ? AND ta.subject_id = ? AND ex.id = ?`,
      [teacher.id, es.subject_id, es.exam_id]
    );
    if (assigned.length === 0) {
      const err = new Error("Forbidden: you are not assigned to teach this class or subject.");
      err.statusCode = 403;
      throw err;
    }
    const window = await deadlineService.checkGradingWindow(exam ? exam.end_date : null);
    if (!window.isOpen) {
      const err = new Error(`Forbidden: Grading window has closed (${window.reason}). Please submit a Correction Request for admin approval.`);
      err.statusCode = 403;
      throw err;
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const rec of records) {
      const studentId = rec.student_id;
      const marksObtained = Number(rec.marks_obtained);
      const remarks = rec.remarks || null;

      if (marksObtained > Number(es.total_marks)) {
        const err = new Error(`Marks (${marksObtained}) cannot exceed total marks (${es.total_marks}) for student ${studentId}.`);
        err.statusCode = 400;
        throw err;
      }

      const { grade, status: resultStatus } = calculateGrade(
        marksObtained,
        Number(es.total_marks),
        Number(es.passing_marks)
      );

      const [existing] = await conn.execute(
        "SELECT id FROM results WHERE student_id = ? AND exam_subject_id = ?",
        [studentId, exam_subject_id]
      );

      if (existing.length > 0) {
        await conn.execute(
          `UPDATE results SET marks_obtained = ?, grade = ?, result_status = ?, remarks = ? WHERE id = ?`,
          [marksObtained, grade, resultStatus, remarks, existing[0].id]
        );
      } else {
        const newId = crypto.randomUUID();
        await conn.execute(
          `INSERT INTO results (id, student_id, exam_subject_id, marks_obtained, grade, result_status, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId, studentId, exam_subject_id, marksObtained, grade, resultStatus, remarks]
        );
      }
    }

    if (requester && requester.userId) {
      await auditRepo.createAuditLog(
        {
          entity_type: "results",
          entity_id: exam_subject_id,
          action: "BULK_SAVE_RESULTS",
          user_id: requester.userId,
          user_role: requester.role,
          user_name: requester.name || requester.email,
          new_values: { count: records.length, exam_subject_id },
          reason: `Recorded grades for ${records.length} student(s)`,
        },
        conn
      );
    }

    await conn.commit();
    return { message: `Successfully saved marks for ${records.length} student(s).`, count: records.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function removeResult(idParam) {
  const id = validateId(idParam);
  const existing = await repo.findResultById(id);
  if (!existing) {
    const err = new Error("Result record not found.");
    err.statusCode = 404;
    throw err;
  }

  await repo.removeResult(id);
  return { message: "Result record deleted successfully." };
}

module.exports = {
  getAllExams,
  getExamById,
  createExam,
  patchExam,
  removeExam,
  getAllExamSubjects,
  getExamSubjectById,
  createExamSubject,
  patchExamSubject,
  removeExamSubject,
  getAllResults,
  getResultById,
  createResult,
  patchResult,
  createBulkResults,
  removeResult,
};
