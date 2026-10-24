"use strict";

const pool = require("../../config/db");

const SAFE_COLS = `
  s.id,
  s.class_id,
  c.class_name,
  s.section_name,
  s.capacity,
  s.created_at
`;

async function findAll({ page = 1, limit = 20, class_id = null, search = null }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (class_id) {
    where.push("s.class_id = ?");
    params.push(class_id);
  }

  if (search) {
    where.push("(s.section_name LIKE ? OR c.class_name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM sections s JOIN classes c ON c.id = s.class_id ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM sections s
     JOIN classes c ON c.id = s.class_id
     ${whereSql}
     ORDER BY c.class_name ASC, s.section_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { sections: rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM sections s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findByClassAndName(classId, sectionName) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM sections s
     JOIN classes c ON c.id = s.class_id
     WHERE s.class_id = ? AND s.section_name = ?`,
    [classId, sectionName]
  );
  return rows[0] || null;
}

async function create({ id, class_id, section_name, capacity }) {
  await pool.execute(
    `INSERT INTO sections (id, class_id, section_name, capacity) VALUES (?, ?, ?, ?)`,
    [id, class_id, section_name, capacity !== undefined ? capacity : null]
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
  await pool.execute(`UPDATE sections SET ${sets.join(", ")} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute(`DELETE FROM sections WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countDependents(id) {
  const [[{ cnt: enrollments }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM enrollments WHERE section_id = ?`,
    [id]
  );
  const [[{ cnt: assignments }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM teacher_assignments WHERE section_id = ?`,
    [id]
  );

  return {
    enrollments: Number(enrollments),
    assignments: Number(assignments),
  };
}

module.exports = {
  findAll,
  findById,
  findByClassAndName,
  create,
  update,
  remove,
  countDependents,
};
