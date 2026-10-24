"use strict";

const pool = require("../../config/db");

const SAFE_COLS = `c.id, c.class_name, c.description, c.created_at`;

async function findAll({ page = 1, limit = 20, search = null }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (search) {
    where.push("(c.class_name LIKE ? OR c.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM classes c ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT
       c.id, c.class_name, c.description, c.created_at,
       COUNT(DISTINCT s.id) AS section_count,
       COALESCE(SUM(s.capacity), 0) AS total_capacity,
       COUNT(DISTINCT e.id) AS total_enrolled
     FROM classes c
     LEFT JOIN sections s ON s.class_id = c.id
     LEFT JOIN enrollments e ON e.class_id = c.id AND e.status = 'active'
     ${whereSql}
     GROUP BY c.id, c.class_name, c.description, c.created_at
     ORDER BY c.class_name ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { classes: rows, total: Number(total) };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT
       c.id, c.class_name, c.description, c.created_at,
       COUNT(DISTINCT s.id) AS section_count,
       COALESCE(SUM(s.capacity), 0) AS total_capacity,
       COUNT(DISTINCT e.id) AS total_enrolled
     FROM classes c
     LEFT JOIN sections s ON s.class_id = c.id
     LEFT JOIN enrollments e ON e.class_id = c.id AND e.status = 'active'
     WHERE c.id = ?
     GROUP BY c.id, c.class_name, c.description, c.created_at`,
    [id]
  );
  if (!rows[0]) return null;

  const cls = rows[0];

  const [sections] = await pool.execute(
    `SELECT
       s.id, s.section_name, s.capacity,
       (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status = 'active') AS enrolled_count,
       (
         SELECT GROUP_CONCAT(DISTINCT CONCAT(t.first_name, ' ', t.last_name) SEPARATOR ', ')
         FROM teacher_assignments ta
         JOIN teachers t ON t.id = ta.teacher_id
         WHERE ta.section_id = s.id
       ) AS teachers
     FROM sections s
     WHERE s.class_id = ?
     ORDER BY s.section_name ASC`,
    [id]
  );

  cls.sections = sections || [];
  return cls;
}

async function findByName(className) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_COLS} FROM classes c WHERE c.class_name = ?`,
    [className]
  );
  return rows[0] || null;
}

async function create({ id, class_name, description }) {
  await pool.execute(
    `INSERT INTO classes (id, class_name, description) VALUES (?, ?, ?)`,
    [id, class_name, description || null]
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
  await pool.execute(`UPDATE classes SET ${sets.join(", ")} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute(`DELETE FROM classes WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countDependents(id) {
  const [[{ cnt: sections }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM sections WHERE class_id = ?`,
    [id]
  );
  const [[{ cnt: enrollments }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM enrollments WHERE class_id = ?`,
    [id]
  );
  const [[{ cnt: assignments }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM teacher_assignments WHERE class_id = ?`,
    [id]
  );
  const [[{ cnt: exams }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM examinations WHERE class_id = ?`,
    [id]
  );
  const [[{ cnt: fees }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM fee_structures WHERE class_id = ?`,
    [id]
  );

  return {
    sections: Number(sections),
    enrollments: Number(enrollments),
    assignments: Number(assignments),
    exams: Number(exams),
    fees: Number(fees),
  };
}

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  update,
  remove,
  countDependents,
};
