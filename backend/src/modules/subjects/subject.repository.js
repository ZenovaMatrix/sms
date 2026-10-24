"use strict";

const pool = require("../../config/db");

const SAFE_COLS = `s.id, s.subject_name, s.subject_code, s.description, s.status, s.created_at`;

async function findAll({ page = 1, limit = 20, status = null, search = null }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (status) {
    where.push("s.status = ?");
    params.push(status);
  }

  if (search) {
    where.push("(s.subject_name LIKE ? OR s.subject_code LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM subjects s ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM subjects s
     ${whereSql}
     ORDER BY s.subject_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { subjects: rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM subjects s WHERE s.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findByCode(code) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM subjects s WHERE s.subject_code = ?`,
    [code]
  );
  return rows[0] || null;
}

async function create({ id, subject_name, subject_code, description, status }) {
  await pool.execute(
    `INSERT INTO subjects (id, subject_name, subject_code, description, status) VALUES (?, ?, ?, ?, ?)`,
    [id, subject_name, subject_code, description || null, status || "active"]
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
  await pool.execute(`UPDATE subjects SET ${sets.join(", ")} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute(`DELETE FROM subjects WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countDependents(id) {
  const [[{ cnt: assignments }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM teacher_assignments WHERE subject_id = ?`,
    [id]
  );
  const [[{ cnt: examSubjects }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM exam_subjects WHERE subject_id = ?`,
    [id]
  );

  return {
    assignments: Number(assignments),
    examSubjects: Number(examSubjects),
  };
}

module.exports = {
  findAll,
  findById,
  findByCode,
  create,
  update,
  remove,
  countDependents,
};
