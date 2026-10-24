"use strict";

const crypto = require("crypto");
const pool = require("../../config/db");

async function createAuditLog({
  entity_type,
  entity_id = null,
  action,
  user_id,
  user_role,
  user_name = null,
  old_values = null,
  new_values = null,
  reason = null,
  ip_address = null,
}, connection = null) {
  const id = crypto.randomUUID();
  const db = connection || pool;

  await db.execute(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, user_id, user_role, user_name, old_values, new_values, reason, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entity_type,
      entity_id,
      action,
      user_id,
      user_role,
      user_name,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      reason,
      ip_address,
    ]
  );

  return { id };
}

async function getAuditLogs({ entity_type, entity_id, user_id, limit = 50, page = 1 }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (entity_type) {
    where.push("entity_type = ?");
    params.push(entity_type);
  }
  if (entity_id) {
    where.push("entity_id = ?");
    params.push(entity_id);
  }
  if (user_id) {
    where.push("user_id = ?");
    params.push(user_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)]
  );

  return {
    logs: rows.map((r) => ({
      ...r,
      old_values: r.old_values ? (typeof r.old_values === "string" ? JSON.parse(r.old_values) : r.old_values) : null,
      new_values: r.new_values ? (typeof r.new_values === "string" ? JSON.parse(r.new_values) : r.new_values) : null,
    })),
    total,
  };
}

module.exports = {
  createAuditLog,
  getAuditLogs,
};
