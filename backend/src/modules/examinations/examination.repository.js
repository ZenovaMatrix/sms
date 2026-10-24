"use strict";

const pool = require("../../config/db");

const EXAM_COLS = `
  ex.id,
  ex.academic_year_id,
  ay.year_name,
  ex.term_id,
  tm.term_name,
  ex.class_id,
  c.class_name,
  ex.exam_name,
  DATE_FORMAT(ex.start_date, '%Y-%m-%d') AS start_date,
  DATE_FORMAT(ex.end_date, '%Y-%m-%d') AS end_date,
  ex.status,
  ex.created_at
`;

const EXAM_SUB_COLS = `
  es.id,
  es.exam_id,
  ex.exam_name,
  es.subject_id,
  sub.subject_name,
  sub.subject_code,
  es.total_marks,
  es.passing_marks,
  DATE_FORMAT(es.exam_date, '%Y-%m-%d') AS exam_date,
  es.created_at
`;

const RESULT_COLS = `
  r.id,
  r.student_id,
  s.student_id AS student_number,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  s.user_id AS student_user_id,
  r.exam_subject_id,
  es.exam_id,
  ex.exam_name,
  ex.academic_year_id,
  ay.year_name AS academic_year_name,
  ex.class_id,
  c.class_name,
  en.section_id,
  sec.section_name,
  es.subject_id,
  sub.subject_name,
  es.total_marks,
  es.passing_marks,
  r.marks_obtained,
  r.grade,
  r.result_status,
  r.remarks,
  r.created_at
`;

// ─── EXAMINATIONS ─────────────────────────────────────────────────────────────

async function findAllExams({
  page = 1,
  limit = 20,
  academic_year_id = null,
  term_id = null,
  class_id = null,
  status = null,
  search = null,
}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (academic_year_id) {
    where.push("ex.academic_year_id = ?");
    params.push(academic_year_id);
  }
  if (term_id) {
    where.push("ex.term_id = ?");
    params.push(term_id);
  }
  if (class_id) {
    where.push("ex.class_id = ?");
    params.push(class_id);
  }
  if (status) {
    where.push("ex.status = ?");
    params.push(status);
  }
  if (search) {
    where.push("ex.exam_name LIKE ?");
    params.push(`%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM examinations ex
     JOIN academic_years ay ON ay.id = ex.academic_year_id
     JOIN terms tm ON tm.id = ex.term_id
     JOIN classes c ON c.id = ex.class_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${EXAM_COLS} FROM examinations ex
     JOIN academic_years ay ON ay.id = ex.academic_year_id
     JOIN terms tm ON tm.id = ex.term_id
     JOIN classes c ON c.id = ex.class_id
     ${whereSql}
     ORDER BY ex.start_date DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { examinations: rows, total: Number(total) };
}

async function findExamById(id) {
  const [rows] = await pool.execute(
    `SELECT ${EXAM_COLS} FROM examinations ex
     JOIN academic_years ay ON ay.id = ex.academic_year_id
     JOIN terms tm ON tm.id = ex.term_id
     JOIN classes c ON c.id = ex.class_id
     WHERE ex.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function createExam({
  id,
  academic_year_id,
  term_id,
  class_id,
  exam_name,
  start_date,
  end_date,
  status,
}) {
  await pool.execute(
    `INSERT INTO examinations (id, academic_year_id, term_id, class_id, exam_name, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      academic_year_id,
      term_id,
      class_id,
      exam_name,
      start_date || null,
      end_date || null,
      status || "upcoming",
    ]
  );
  return findExamById(id);
}

async function updateExam(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    sets.push(`\`${k}\` = ?`);
    params.push(v);
  }
  if (!sets.length) return findExamById(id);
  params.push(id);
  await pool.execute(`UPDATE examinations SET ${sets.join(", ")} WHERE id = ?`, params);
  return findExamById(id);
}

async function removeExam(id) {
  const [result] = await pool.execute(`DELETE FROM examinations WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countExamDependents(id) {
  const [[{ cnt: subjects }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM exam_subjects WHERE exam_id = ?`,
    [id]
  );
  return { subjects: Number(subjects) };
}

// ─── EXAM SUBJECTS ────────────────────────────────────────────────────────────

async function findAllExamSubjects({ exam_id = null, subject_id = null }) {
  const where = [];
  const params = [];

  if (exam_id) {
    where.push("es.exam_id = ?");
    params.push(exam_id);
  }
  if (subject_id) {
    where.push("es.subject_id = ?");
    params.push(subject_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.execute(
    `SELECT ${EXAM_SUB_COLS} FROM exam_subjects es
     JOIN examinations ex ON ex.id = es.exam_id
     JOIN subjects sub ON sub.id = es.subject_id
     ${whereSql}
     ORDER BY es.exam_date ASC`,
    params
  );

  return rows;
}

async function findExamSubjectById(id) {
  const [rows] = await pool.execute(
    `SELECT ${EXAM_SUB_COLS} FROM exam_subjects es
     JOIN examinations ex ON ex.id = es.exam_id
     JOIN subjects sub ON sub.id = es.subject_id
     WHERE es.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findDuplicateExamSubject(exam_id, subject_id) {
  const [rows] = await pool.execute(
    `SELECT id FROM exam_subjects WHERE exam_id = ? AND subject_id = ?`,
    [exam_id, subject_id]
  );
  return rows[0] || null;
}

async function createExamSubject({ id, exam_id, subject_id, total_marks, passing_marks, exam_date }) {
  await pool.execute(
    `INSERT INTO exam_subjects (id, exam_id, subject_id, total_marks, passing_marks, exam_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, exam_id, subject_id, total_marks, passing_marks, exam_date || null]
  );
  return findExamSubjectById(id);
}

async function updateExamSubject(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    sets.push(`\`${k}\` = ?`);
    params.push(v);
  }
  if (!sets.length) return findExamSubjectById(id);
  params.push(id);
  await pool.execute(`UPDATE exam_subjects SET ${sets.join(", ")} WHERE id = ?`, params);
  return findExamSubjectById(id);
}

async function removeExamSubject(id) {
  const [result] = await pool.execute(`DELETE FROM exam_subjects WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countExamSubjectDependents(id) {
  const [[{ cnt: results }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM results WHERE exam_subject_id = ?`,
    [id]
  );
  return { results: Number(results) };
}

// ─── RESULTS ──────────────────────────────────────────────────────────────────

async function findAllResults({
  page = 1,
  limit = 20,
  student_id = null,
  exam_id = null,
  exam_subject_id = null,
  subject_id = null,
  class_id = null,
  academic_year_id = null,
  section_id = null,
  result_status = null,
  teacher_id = null,
  search = null,
}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (student_id) {
    where.push("r.student_id = ?");
    params.push(student_id);
  }
  if (exam_id) {
    where.push("es.exam_id = ?");
    params.push(exam_id);
  }
  if (exam_subject_id) {
    where.push("r.exam_subject_id = ?");
    params.push(exam_subject_id);
  }
  if (subject_id) {
    where.push("es.subject_id = ?");
    params.push(subject_id);
  }
  if (class_id) {
    where.push("ex.class_id = ?");
    params.push(class_id);
  }
  if (academic_year_id) {
    where.push("ex.academic_year_id = ?");
    params.push(academic_year_id);
  }
  if (section_id) {
    where.push("en.section_id = ?");
    params.push(section_id);
  }
  if (result_status) {
    where.push("r.result_status = ?");
    params.push(result_status);
  }
  if (teacher_id) {
    where.push("EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = ? AND ta.class_id = ex.class_id AND ta.subject_id = es.subject_id)");
    params.push(teacher_id);
  }
  if (search) {
    where.push("(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_id LIKE ? OR CONCAT(s.first_name, ' ', s.last_name) LIKE ?)");
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(DISTINCT r.id) AS total FROM results r
     JOIN students s ON s.id = r.student_id
     JOIN exam_subjects es ON es.id = r.exam_subject_id
     JOIN examinations ex ON ex.id = es.exam_id
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN classes c ON c.id = ex.class_id
     LEFT JOIN academic_years ay ON ay.id = ex.academic_year_id
     LEFT JOIN enrollments en ON en.student_id = r.student_id AND en.class_id = ex.class_id
     LEFT JOIN sections sec ON sec.id = en.section_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${RESULT_COLS} FROM results r
     JOIN students s ON s.id = r.student_id
     JOIN exam_subjects es ON es.id = r.exam_subject_id
     JOIN examinations ex ON ex.id = es.exam_id
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN classes c ON c.id = ex.class_id
     LEFT JOIN academic_years ay ON ay.id = ex.academic_year_id
     LEFT JOIN enrollments en ON en.student_id = r.student_id AND en.class_id = ex.class_id
     LEFT JOIN sections sec ON sec.id = en.section_id
     ${whereSql}
     ORDER BY ex.exam_name ASC, sub.subject_name ASC, s.last_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { results: rows, total: Number(total) };
}

async function findResultById(id) {
  const [rows] = await pool.execute(
    `SELECT ${RESULT_COLS} FROM results r
     JOIN students s ON s.id = r.student_id
     JOIN exam_subjects es ON es.id = r.exam_subject_id
     JOIN examinations ex ON ex.id = es.exam_id
     JOIN subjects sub ON sub.id = es.subject_id
     LEFT JOIN classes c ON c.id = ex.class_id
     LEFT JOIN academic_years ay ON ay.id = ex.academic_year_id
     LEFT JOIN enrollments en ON en.student_id = r.student_id AND en.class_id = ex.class_id
     LEFT JOIN sections sec ON sec.id = en.section_id
     WHERE r.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findDuplicateResult(student_id, exam_subject_id) {
  const [rows] = await pool.execute(
    `SELECT id FROM results WHERE student_id = ? AND exam_subject_id = ?`,
    [student_id, exam_subject_id]
  );
  return rows[0] || null;
}

async function createResult({
  id,
  student_id,
  exam_subject_id,
  marks_obtained,
  grade,
  result_status,
  remarks,
}) {
  await pool.execute(
    `INSERT INTO results (id, student_id, exam_subject_id, marks_obtained, grade, result_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      student_id,
      exam_subject_id,
      marks_obtained,
      grade || null,
      result_status || null,
      remarks || null,
    ]
  );
  return findResultById(id);
}

async function updateResult(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    sets.push(`\`${k}\` = ?`);
    params.push(v);
  }
  if (!sets.length) return findResultById(id);
  params.push(id);
  await pool.execute(`UPDATE results SET ${sets.join(", ")} WHERE id = ?`, params);
  return findResultById(id);
}

async function removeResult(id) {
  const [result] = await pool.execute(`DELETE FROM results WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findAllExams,
  findExamById,
  createExam,
  updateExam,
  removeExam,
  countExamDependents,
  findAllExamSubjects,
  findExamSubjectById,
  findDuplicateExamSubject,
  createExamSubject,
  updateExamSubject,
  removeExamSubject,
  countExamSubjectDependents,
  findAllResults,
  findResultById,
  findDuplicateResult,
  createResult,
  updateResult,
  removeResult,
};
