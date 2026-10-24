"use strict";

/**
 * term.repository.js
 *
 * Confirmed schema columns: id, academic_year_id, term_name, start_date, end_date, status
 * No updated_at.
 */

const pool = require("../../config/db");

const SAFE_COLS = `
  t.id,
  t.academic_year_id,
  t.term_name,
  t.start_date,
  t.end_date,
  t.status,
  ay.year_name AS academic_year_name
`;

async function findAll({ page, limit, academic_year_id, status, search }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (academic_year_id) { where.push("t.academic_year_id = ?"); params.push(academic_year_id); }
  if (status) { where.push("t.status = ?"); params.push(status); }
  if (search) { where.push("t.term_name LIKE ?"); params.push(`%${search}%`); }

  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM terms t LEFT JOIN academic_years ay ON t.academic_year_id = ay.id ${w}`,
    params
  );
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM terms t LEFT JOIN academic_years ay ON t.academic_year_id = ay.id ${w} ORDER BY t.start_date ASC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  return { terms: rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM terms t LEFT JOIN academic_years ay ON t.academic_year_id = ay.id WHERE t.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findByYearAndName(academic_year_id, term_name) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM terms t LEFT JOIN academic_years ay ON t.academic_year_id = ay.id WHERE t.academic_year_id = ? AND t.term_name = ?`,
    [academic_year_id, term_name]
  );
  return rows[0] || null;
}

async function create({ id, academic_year_id, term_name, start_date, end_date, status }) {
  await pool.execute(
    `INSERT INTO terms (id, academic_year_id, term_name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, academic_year_id, term_name, start_date, end_date, status]
  );
  return findById(id);
}

async function update(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) { sets.push(`\`${k}\` = ?`); params.push(v); }
  if (!sets.length) return findById(id);
  params.push(id);
  await pool.execute(`UPDATE terms SET ${sets.join(", ")} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const [r] = await pool.execute(`DELETE FROM terms WHERE id = ?`, [id]);
  return r.affectedRows > 0;
}

async function countDependents(id) {
  const [[{ cnt: assignments }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM teacher_assignments WHERE term_id = ?`, [id]
  );
  return { assignments: Number(assignments) };
}

module.exports = { findAll, findById, findByYearAndName, create, update, remove, countDependents };
