"use strict";

const pool = require("../../config/db");

const CORRECTION_COLS = `
  cr.id,
  cr.request_type,
  cr.teacher_id,
  cr.class_id,
  cr.section_id,
  cr.subject_id,
  cr.target_id,
  cr.target_date,
  cr.proposed_changes,
  cr.current_data,
  cr.reason,
  cr.status,
  cr.admin_notes,
  cr.reviewed_by,
  cr.reviewed_at,
  cr.created_at,
  cr.updated_at,
  t.first_name AS teacher_first_name,
  t.last_name AS teacher_last_name,
  u.email AS teacher_email,
  c.class_name,
  sec.section_name,
  sub.subject_name
`;

async function createRequest({
  id,
  request_type,
  teacher_id,
  class_id = null,
  section_id = null,
  subject_id = null,
  target_id = null,
  target_date = null,
  proposed_changes,
  current_data = null,
  reason,
}) {
  await pool.execute(
    `INSERT INTO correction_requests (
      id, request_type, teacher_id, class_id, section_id, subject_id,
      target_id, target_date, proposed_changes, current_data, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      request_type,
      teacher_id,
      class_id,
      section_id,
      subject_id,
      target_id,
      target_date,
      JSON.stringify(proposed_changes),
      current_data ? JSON.stringify(current_data) : null,
      reason,
    ]
  );

  return findRequestById(id);
}

async function findRequestById(id) {
  const [rows] = await pool.execute(
    `SELECT ${CORRECTION_COLS}
     FROM correction_requests cr
     JOIN teachers t ON t.id = cr.teacher_id
     JOIN users u ON u.id = t.user_id
     LEFT JOIN classes c ON c.id = cr.class_id
     LEFT JOIN sections sec ON sec.id = cr.section_id
     LEFT JOIN subjects sub ON sub.id = cr.subject_id
     WHERE cr.id = ?`,
    [id]
  );

  if (!rows[0]) return null;
  return formatRow(rows[0]);
}

async function findAllRequests({ teacher_id = null, request_type = null, status = null, page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (teacher_id) {
    where.push("cr.teacher_id = ?");
    params.push(teacher_id);
  }
  if (request_type) {
    where.push("cr.request_type = ?");
    params.push(request_type);
  }
  if (status) {
    where.push("cr.status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM correction_requests cr
     JOIN teachers t ON t.id = cr.teacher_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${CORRECTION_COLS}
     FROM correction_requests cr
     JOIN teachers t ON t.id = cr.teacher_id
     JOIN users u ON u.id = t.user_id
     LEFT JOIN classes c ON c.id = cr.class_id
     LEFT JOIN sections sec ON sec.id = cr.section_id
     LEFT JOIN subjects sub ON sub.id = cr.subject_id
     ${whereSql}
     ORDER BY cr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)]
  );

  return {
    requests: rows.map(formatRow),
    total,
  };
}

async function reviewRequest(id, { status, admin_notes, reviewed_by }, connection = null) {
  const db = connection || pool;
  await db.execute(
    `UPDATE correction_requests
     SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, admin_notes || null, reviewed_by, id]
  );

  return findRequestById(id);
}

function formatRow(r) {
  return {
    ...r,
    proposed_changes: r.proposed_changes ? (typeof r.proposed_changes === "string" ? JSON.parse(r.proposed_changes) : r.proposed_changes) : null,
    current_data: r.current_data ? (typeof r.current_data === "string" ? JSON.parse(r.current_data) : r.current_data) : null,
  };
}

module.exports = {
  createRequest,
  findRequestById,
  findAllRequests,
  reviewRequest,
};
