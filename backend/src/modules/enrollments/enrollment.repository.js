"use strict";

const pool = require("../../config/db");

const SAFE_COLS = `
  e.id,
  e.student_id,
  s.student_id AS student_number,
  s.first_name,
  s.last_name,
  s.user_id AS student_user_id,
  e.academic_year_id,
  ay.year_name,
  e.class_id,
  c.class_name,
  e.section_id,
  sec.section_name,
  e.course_id,
  co.course_name,
  e.enrollment_date,
  e.status,
  e.created_at
`;

async function findAll({
  page = 1,
  limit = 20,
  student_id = null,
  academic_year_id = null,
  class_id = null,
  section_id = null,
  status = null,
  search = null,
}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (student_id) {
    where.push("e.student_id = ?");
    params.push(student_id);
  }

  if (academic_year_id) {
    where.push("e.academic_year_id = ?");
    params.push(academic_year_id);
  }

  if (class_id) {
    where.push("e.class_id = ?");
    params.push(class_id);
  }

  if (section_id) {
    where.push("e.section_id = ?");
    params.push(section_id);
  }

  if (status) {
    where.push("e.status = ?");
    params.push(status);
  }

  if (search) {
    where.push("(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_id LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN academic_years ay ON ay.id = e.academic_year_id
     JOIN classes c ON c.id = e.class_id
     JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN courses co ON co.id = e.course_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN academic_years ay ON ay.id = e.academic_year_id
     JOIN classes c ON c.id = e.class_id
     JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN courses co ON co.id = e.course_id
     ${whereSql}
     ORDER BY e.enrollment_date DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { enrollments: rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN academic_years ay ON ay.id = e.academic_year_id
     JOIN classes c ON c.id = e.class_id
     JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN courses co ON co.id = e.course_id
     WHERE e.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findByStudentAndYear(studentId, academicYearId) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN academic_years ay ON ay.id = e.academic_year_id
     JOIN classes c ON c.id = e.class_id
     JOIN sections sec ON sec.id = e.section_id
     LEFT JOIN courses co ON co.id = e.course_id
     WHERE e.student_id = ? AND e.academic_year_id = ?`,
    [studentId, academicYearId]
  );
  return rows[0] || null;
}

async function create({
  id,
  student_id,
  academic_year_id,
  class_id,
  section_id,
  course_id,
  enrollment_date,
  status,
}) {
  await pool.execute(
    `INSERT INTO enrollments (id, student_id, academic_year_id, class_id, section_id, course_id, enrollment_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      student_id,
      academic_year_id,
      class_id,
      section_id,
      course_id || null,
      enrollment_date,
      status || "active",
    ]
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
  await pool.execute(`UPDATE enrollments SET ${sets.join(", ")} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute(`DELETE FROM enrollments WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findAll,
  findById,
  findByStudentAndYear,
  create,
  update,
  remove,
};
