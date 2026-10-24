"use strict";

const pool = require("../../config/db");

/**
 * user.repository.js
 *
 * Direct database access layer for Users.
 * Always selects explicit safe columns: id, name, email, role, phone, status, created_at, updated_at
 * NEVER selects or returns password_hash.
 * Uses parameterized queries for all operations.
 */

const SAFE_USER_COLUMNS = "id, name, email, role, phone, status, created_at, updated_at";

async function findAllUsers({ page = 1, limit = 10, role, status, search }) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const queryParams = [];

  if (role) {
    whereClauses.push("role = ?");
    queryParams.push(role);
  }

  if (status) {
    whereClauses.push("status = ?");
    queryParams.push(status);
  }

  if (search && search.trim() !== "") {
    const searchPattern = `%${search.trim()}%`;
    whereClauses.push("(name LIKE ? OR email LIKE ?)");
    queryParams.push(searchPattern, searchPattern);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Query total matching records
  const countSql = `SELECT COUNT(*) AS total FROM users ${whereSql}`;
  const [countRows] = await pool.execute(countSql, queryParams);
  const total = Number(countRows[0].total);

  // Query page items with limit and offset
  const dataSql = `
    SELECT ${SAFE_USER_COLUMNS}
    FROM users
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  // limit and offset must be numbers for mysql2 prepared statement execution
  const dataParams = [...queryParams, Number(limit), Number(offset)];
  const [users] = await pool.execute(dataSql, dataParams);

  return {
    users,
    total,
  };
}

async function findUserById(id) {
  const sql = `SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = ?`;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
}

async function findUserByEmail(email) {
  const sql = `SELECT ${SAFE_USER_COLUMNS} FROM users WHERE email = ?`;
  const [rows] = await pool.execute(sql, [email]);
  return rows[0] || null;
}

async function updateUser(id, updates) {
  const setClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    params.push(value);
  }

  if (setClauses.length === 0) return null;

  params.push(id);
  const sql = `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`;

  const [result] = await pool.execute(sql, params);
  if (result.affectedRows === 0) {
    return null;
  }

  return await findUserById(id);
}

async function createUser({ id, name, email, password_hash, role, phone = null, status = "active" }) {
  const sql = `
    INSERT INTO users (id, name, email, password_hash, role, phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  await pool.execute(sql, [id, name, email, password_hash, role, phone, status]);
  return await findUserById(id);
}

module.exports = {
  findAllUsers,
  findUserById,
  findUserByEmail,
  updateUser,
  createUser,
};
