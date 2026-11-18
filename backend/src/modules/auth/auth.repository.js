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

async function findUserById(id) {
  const sql = `
    SELECT id, name, email, password_hash, role, phone, status
    FROM users
    WHERE id = ?
  `;
  const [rows] = await pool.execute(sql, [id]);
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

async function storeAdminOtp({ id, userId, email, otpHash, expiresAt }) {
  // Clear any existing active OTPs for this user first
  await pool.execute(`DELETE FROM admin_otp WHERE user_id = ?`, [userId]);

  const sql = `
    INSERT INTO admin_otp (id, user_id, email, otp_hash, attempts, max_attempts, expires_at)
    VALUES (?, ?, ?, ?, 0, 5, ?)
  `;
  await pool.execute(sql, [id, userId, email, otpHash, expiresAt]);
}

async function findAdminOtpByUserId(userId) {
  const sql = `
    SELECT id, user_id, email, otp_hash, attempts, max_attempts, expires_at, created_at
    FROM admin_otp
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows[0] || null;
}

async function incrementOtpAttempts(id) {
  const sql = `UPDATE admin_otp SET attempts = attempts + 1 WHERE id = ?`;
  await pool.execute(sql, [id]);
}

async function deleteAdminOtp(id) {
  const sql = `DELETE FROM admin_otp WHERE id = ?`;
  await pool.execute(sql, [id]);
}

module.exports = {
  findUserForAuth,
  findUserById,
  updateUserPassword,
  storeAdminOtp,
  findAdminOtpByUserId,
  incrementOtpAttempts,
  deleteAdminOtp,
};
