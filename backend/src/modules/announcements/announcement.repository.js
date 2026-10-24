"use strict";

/**
 * announcement.repository.js
 *
 * Database access layer for Announcements.
 */

const pool = require("../../config/db");

const SAFE_COLS = `
  a.id,
  a.created_by,
  u.name AS creator_name,
  u.role AS creator_role,
  a.title,
  a.message,
  a.target_type,
  a.class_id,
  c.class_name,
  a.section_id,
  s.section_name,
  a.publish_date,
  a.expiry_date,
  a.status,
  a.created_at
`;

async function findAll({ page = 1, limit = 10, status, target_type, class_id, section_id, search, audienceRole, audienceClassId, audienceSectionId }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (status) {
    where.push("a.status = ?");
    params.push(status);
  }

  if (target_type) {
    where.push("a.target_type = ?");
    params.push(target_type);
  }

  if (class_id) {
    where.push("a.class_id = ?");
    params.push(class_id);
  }

  if (section_id) {
    where.push("a.section_id = ?");
    params.push(section_id);
  }

  if (search && search.trim() !== "") {
    where.push("(a.title LIKE ? OR a.message LIKE ?)");
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  // Audience filtering for non-admins:
  // Show announcements targeted to 'all', their role, or their class/section
  if (audienceRole && audienceRole !== "admin") {
    const roleTarget = audienceRole === "teacher" ? "teachers" : audienceRole === "student" ? "students" : "parents";
    const audienceConditions = ["a.target_type = 'all'", "a.target_type = ?"];
    params.push(roleTarget);

    if (audienceClassId) {
      audienceConditions.push("(a.target_type = 'class' AND a.class_id = ?)");
      params.push(audienceClassId);
    }
    if (audienceSectionId) {
      audienceConditions.push("(a.target_type = 'section' AND a.section_id = ?)");
      params.push(audienceSectionId);
    }

    where.push(`(${audienceConditions.join(" OR ")})`);
    where.push("a.status = 'published'");
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*) AS total FROM announcements a ${whereSql}`;
  const [countRows] = await pool.execute(countSql, params);
  const total = Number(countRows[0].total);

  const dataSql = `
    SELECT ${SAFE_COLS}
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
    LEFT JOIN classes c ON c.id = a.class_id
    LEFT JOIN sections s ON s.id = a.section_id
    ${whereSql}
    ORDER BY a.publish_date DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(dataSql, [...params, Number(limit), Number(offset)]);

  return { announcements: rows, total };
}

async function findById(id) {
  const sql = `
    SELECT ${SAFE_COLS}
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
    LEFT JOIN classes c ON c.id = a.class_id
    LEFT JOIN sections s ON s.id = a.section_id
    WHERE a.id = ?
  `;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
}

async function create({ id, created_by, title, message, target_type, class_id, section_id, publish_date, expiry_date, status }) {
  const sql = `
    INSERT INTO announcements (id, created_by, title, message, target_type, class_id, section_id, publish_date, expiry_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await pool.execute(sql, [id, created_by, title, message, target_type, class_id, section_id, publish_date, expiry_date, status]);
  return findById(id);
}

async function update(id, updates) {
  const sets = [];
  const params = [];

  for (const [key, val] of Object.entries(updates)) {
    sets.push(`\`${key}\` = ?`);
    params.push(val);
  }

  if (sets.length === 0) return findById(id);

  params.push(id);
  const sql = `UPDATE announcements SET ${sets.join(", ")} WHERE id = ?`;
  await pool.execute(sql, params);
  return findById(id);
}

async function remove(id) {
  const sql = `DELETE FROM announcements WHERE id = ?`;
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
};
