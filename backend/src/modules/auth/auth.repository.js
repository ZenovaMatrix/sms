"use strict";

const pool = require("../../config/db");

/**
 * auth.repository.js
 *
 * Database access layer for Authentication module.
 * Executes parameterized SQL queries only.
 */

async function findUserForAuth(email) {
  const sql = `
    SELECT id, name, email, password_hash, role, phone, status
    FROM users
    WHERE email = ?
  `;
  const [rows] = await pool.execute(sql, [email]);
  return rows[0] || null;
}

async function updateUserPassword(id, passwordHash) {
  const sql = `
    UPDATE users
    SET password_hash = ?
    WHERE id = ?
  `;
  const [result] = await pool.execute(sql, [passwordHash, id]);
  return result.affectedRows > 0;
}

module.exports = {
  findUserForAuth,
  updateUserPassword,
};
