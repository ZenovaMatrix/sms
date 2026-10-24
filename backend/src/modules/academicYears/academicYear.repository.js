"use strict";

/**
 * academicYear.repository.js
 *
 * Database access layer for Academic Years.
 *
 * Rules:
 *   - All queries use parameterized pool.execute() — NO raw string interpolation with user input.
 *   - Never SELECT *; always name explicit columns.
 *   - No Express req/res here — pure data-access functions only.
 *
 * Confirmed schema columns:
 *   id, year_name, start_date, end_date, status
 *   (no created_at, no updated_at)
 */

const pool = require("../../config/db");

const SAFE_COLUMNS = `
  ay.id,
  ay.year_name,
  ay.start_date,
  ay.end_date,
  ay.status
`;

/**
 * Return a paginated list of academic years.
 */
async function findAll({ page, limit, status, search }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (status) {
    where.push("ay.status = ?");
    params.push(status);
  }
  if (search) {
    where.push("ay.year_name LIKE ?");
    params.push(`%${search}%`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM academic_years ay ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLUMNS} FROM academic_years ay ${whereSql} ORDER BY ay.start_date DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { academicYears: rows, total: Number(total) };
}

/**
 * Find a single academic year by its UUID.
 */
async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLUMNS} FROM academic_years ay WHERE ay.id = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Find a single academic year by year_name.
 */
async function findByName(year_name) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLUMNS} FROM academic_years ay WHERE ay.year_name = ?`,
    [year_name]
  );
  return rows[0] || null;
}

/**
 * Insert a new academic year.
 */
async function create({ id, year_name, start_date, end_date, status }) {
  await pool.execute(
    `INSERT INTO academic_years (id, year_name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)`,
    [id, year_name, start_date, end_date, status]
  );
  return findById(id);
}

/**
 * Update allowed fields on an academic year.
 */
async function update(id, updates) {
  const setClauses = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`\`${key}\` = ?`);
    params.push(value);
  }
  if (setClauses.length === 0) return findById(id);
  params.push(id);
  await pool.execute(
    `UPDATE academic_years SET ${setClauses.join(", ")} WHERE id = ?`,
    params
  );
  return findById(id);
}

/**
 * Delete an academic year by UUID.
 */
async function remove(id) {
  const [result] = await pool.execute(
    `DELETE FROM academic_years WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Count dependent records that block deletion.
 */
async function countDependents(id) {
  const [[terms]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM terms WHERE academic_year_id = ?`,
    [id]
  );
  const [[enrollments]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM enrollments WHERE academic_year_id = ?`,
    [id]
  );
  const [[assignments]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM teacher_assignments WHERE academic_year_id = ?`,
    [id]
  );
  const [[sessions]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM teacher_assignments ta
     INNER JOIN attendance_sessions ats ON ats.teacher_assignment_id = ta.id
     WHERE ta.academic_year_id = ?`,
    [id]
  );
  return {
    terms: Number(terms.cnt),
    enrollments: Number(enrollments.cnt),
    assignments: Number(assignments.cnt),
    sessions: Number(sessions.cnt),
  };
}

module.exports = { findAll, findById, findByName, create, update, remove, countDependents };
