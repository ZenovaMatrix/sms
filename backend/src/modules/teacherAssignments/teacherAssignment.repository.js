"use strict";

const pool = require("../../config/db");

const SAFE_COLS = `
  ta.id,
  ta.teacher_id,
  t.employee_id,
  t.first_name AS teacher_first_name,
  t.last_name AS teacher_last_name,
  t.user_id AS teacher_user_id,
  ta.subject_id,
  sub.subject_name,
  sub.subject_code,
  ta.class_id,
  c.class_name,
  ta.section_id,
  sec.section_name,
  ta.academic_year_id,
  ay.year_name,
  ta.term_id,
  tm.term_name,
  (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = ta.class_id AND e.section_id = ta.section_id AND e.status = 'active') AS student_count,
  ta.created_at
`;

async function findAll({
  page = 1,
  limit = 20,
  teacher_id = null,
  subject_id = null,
  class_id = null,
  section_id = null,
  academic_year_id = null,
  term_id = null,
}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (teacher_id) {
    where.push("ta.teacher_id = ?");
    params.push(teacher_id);
  }
  if (subject_id) {
    where.push("ta.subject_id = ?");
    params.push(subject_id);
  }
  if (class_id) {
    where.push("ta.class_id = ?");
    params.push(class_id);
  }
  if (section_id) {
    where.push("ta.section_id = ?");
    params.push(section_id);
  }
  if (academic_year_id) {
    where.push("ta.academic_year_id = ?");
    params.push(academic_year_id);
  }
  if (term_id) {
    where.push("ta.term_id = ?");
    params.push(term_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM teacher_assignments ta
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     JOIN academic_years ay ON ay.id = ta.academic_year_id
     JOIN terms tm ON tm.id = ta.term_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM teacher_assignments ta
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     JOIN academic_years ay ON ay.id = ta.academic_year_id
     JOIN terms tm ON tm.id = ta.term_id
     ${whereSql}
     ORDER BY c.class_name ASC, sec.section_name ASC, sub.subject_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { assignments: rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM teacher_assignments ta
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     JOIN academic_years ay ON ay.id = ta.academic_year_id
     JOIN terms tm ON tm.id = ta.term_id
     WHERE ta.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findDuplicate({
  teacher_id,
  subject_id,
  class_id,
  section_id,
  academic_year_id,
  term_id,
}) {
  const [rows] = await pool.execute(
    `SELECT id FROM teacher_assignments
     WHERE teacher_id = ? AND subject_id = ? AND class_id = ? AND section_id = ? AND academic_year_id = ? AND term_id = ?`,
    [teacher_id, subject_id, class_id, section_id, academic_year_id, term_id]
  );
  return rows[0] || null;
}

async function create({
  id,
  teacher_id,
  subject_id,
  class_id,
  section_id,
  academic_year_id,
  term_id,
}) {
  await pool.execute(
    `INSERT INTO teacher_assignments (id, teacher_id, subject_id, class_id, section_id, academic_year_id, term_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, teacher_id, subject_id, class_id, section_id, academic_year_id, term_id]
  );
  return findById(id);
}

async function update(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    sets.push(`\`${k}\` = ?`);
    params.push(v);
  }
  if (!sets.length) return findById(id);
  params.push(id);
  await pool.execute(`UPDATE teacher_assignments SET ${sets.join(", ")} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute(`DELETE FROM teacher_assignments WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countDependents(id) {
  const [[{ cnt: sessions }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM attendance_sessions WHERE teacher_assignment_id = ?`,
    [id]
  );
  return { sessions: Number(sessions) };
}

module.exports = {
  findAll,
  findById,
  findDuplicate,
  create,
  update,
  remove,
  countDependents,
};
