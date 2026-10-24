"use strict";

const pool = require("../../config/db");

const SAFE_COLS = `d.id, d.department_name, d.department_code, d.description, d.created_at`;

async function findAll({ page, limit, search }) {
  const offset = (page - 1) * limit;
  const where = []; const params = [];
  if (search) { where.push("(d.department_name LIKE ? OR d.department_code LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM departments d ${w}`, params);
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM departments d ${w} ORDER BY d.department_name ASC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  return { departments: rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${SAFE_COLS} FROM departments d WHERE d.id = ?`, [id]);
  return rows[0] || null;
}

async function findByName(name) {
  const [rows] = await pool.execute(`SELECT ${SAFE_COLS} FROM departments d WHERE d.department_name = ?`, [name]);
  return rows[0] || null;
}

async function findByCode(code) {
  const [rows] = await pool.execute(`SELECT ${SAFE_COLS} FROM departments d WHERE d.department_code = ?`, [code]);
  return rows[0] || null;
}

async function create({ id, department_name, department_code, description }) {
  await pool.execute(
    `INSERT INTO departments (id, department_name, department_code, description) VALUES (?, ?, ?, ?)`,
    [id, department_name, department_code, description]
  );
  return findById(id);
}

async function update(id, updates) {
  const sets = []; const params = [];
  for (const [k, v] of Object.entries(updates)) { sets.push(`\`${k}\` = ?`); params.push(v); }
  if (!sets.length) return findById(id);
  params.push(id);
  await pool.execute(`UPDATE departments SET ${sets.join(", ")} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const [r] = await pool.execute(`DELETE FROM departments WHERE id = ?`, [id]);
  return r.affectedRows > 0;
}

async function countDependents(id) {
  const [[{ cnt: teachers }]] = await pool.execute(`SELECT COUNT(*) AS cnt FROM teachers WHERE department_id = ?`, [id]);
  // courses FK is SET NULL, so courses won't block deletion but we warn
  const [[{ cnt: courses }]] = await pool.execute(`SELECT COUNT(*) AS cnt FROM courses WHERE department_id = ?`, [id]);
  return { teachers: Number(teachers), courses: Number(courses) };
}

module.exports = { findAll, findById, findByName, findByCode, create, update, remove, countDependents };
