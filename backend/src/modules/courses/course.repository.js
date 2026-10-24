"use strict";

const pool = require("../../config/db");

const SAFE_COLS = `
  c.id, c.department_id, c.course_name, c.course_code, c.description, c.status, c.created_at,
  d.department_name, d.department_code
`;

async function findAll({ page, limit, department_id, status, search }) {
  const offset = (page - 1) * limit;
  const where = []; const params = [];
  if (department_id) { where.push("c.department_id = ?"); params.push(department_id); }
  if (status) { where.push("c.status = ?"); params.push(status); }
  if (search) { where.push("(c.course_name LIKE ? OR c.course_code LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM courses c LEFT JOIN departments d ON c.department_id = d.id ${w}`, params
  );
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM courses c LEFT JOIN departments d ON c.department_id = d.id ${w} ORDER BY c.course_name ASC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  return { courses: rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM courses c LEFT JOIN departments d ON c.department_id = d.id WHERE c.id = ?`, [id]
  );
  return rows[0] || null;
}

async function findByCode(code) {
  const [rows] = await pool.execute(`SELECT c.id FROM courses c WHERE c.course_code = ?`, [code]);
  return rows[0] || null;
}

async function create({ id, department_id, course_name, course_code, description, status }) {
  await pool.execute(
    `INSERT INTO courses (id, department_id, course_name, course_code, description, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, department_id, course_name, course_code, description, status]
  );
  return findById(id);
}

async function update(id, updates) {
  const sets = []; const params = [];
  for (const [k, v] of Object.entries(updates)) { sets.push(`\`${k}\` = ?`); params.push(v); }
  if (!sets.length) return findById(id);
  params.push(id);
  await pool.execute(`UPDATE courses SET ${sets.join(", ")} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const [r] = await pool.execute(`DELETE FROM courses WHERE id = ?`, [id]);
  return r.affectedRows > 0;
}

async function countDependents(id) {
  // enrollments.course_id FK is SET NULL — MySQL allows delete but we protect business data
  const [[{ cnt: enrollments }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM enrollments WHERE course_id = ?`, [id]
  );
  return { enrollments: Number(enrollments) };
}

module.exports = { findAll, findById, findByCode, create, update, remove, countDependents };
