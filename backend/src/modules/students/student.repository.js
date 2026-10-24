"use strict";

const pool = require("../../config/db");

/**
 * student.repository.js
 *
 * Direct database access layer for the Students module.
 *
 * Rules:
 *   - All queries use parameterized pool.execute() — NO raw string interpolation.
 *   - Never SELECT *; always name explicit, safe columns.
 *   - Never return or select password_hash from users.
 *   - No Express req/res here — pure data-access functions only.
 *
 * students columns selected (safe):
 *   s.id, s.user_id, s.student_id, s.first_name, s.last_name,
 *   s.email, s.phone, s.date_of_birth, s.gender, s.blood_group,
 *   s.address, s.admission_date, s.status, s.created_at, s.updated_at
 *
 * users columns joined (safe — NO password_hash):
 *   u.id AS user_id, u.name AS user_name, u.email AS user_email,
 *   u.phone AS user_phone, u.status AS user_status, u.role AS user_role
 */

// Explicit safe column list for students (aliased to avoid ambiguity with JOIN)
const SAFE_STUDENT_COLUMNS = `
  s.id,
  s.user_id,
  s.student_id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.date_of_birth,
  s.gender,
  s.blood_group,
  s.address,
  s.admission_date,
  s.status,
  s.created_at,
  s.updated_at
`;

// Safe user columns joined (NO password_hash)
const SAFE_USER_JOIN_COLUMNS = `
  u.id        AS linked_user_id,
  u.name      AS linked_user_name,
  u.email     AS linked_user_email,
  u.phone     AS linked_user_phone,
  u.status    AS linked_user_status,
  u.role      AS linked_user_role
`;

/**
 * Fetch a paginated list of students with optional full-text search.
 *
 * Search columns (all from confirmed actual schema):
 *   - s.first_name
 *   - s.last_name
 *   - s.email
 *   - s.student_id   (admission number)
 *
 * @param {{ page: number, limit: number, search: string|null }} params
 * @returns {{ students: object[], total: number }}
 */
async function findAllStudents({ page, limit, search }) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const queryParams = [];

  if (search && search.trim() !== "") {
    const pattern = `%${search.trim()}%`;
    // Search against confirmed student columns only
    whereClauses.push(
      "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR s.student_id LIKE ?)"
    );
    queryParams.push(pattern, pattern, pattern, pattern);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Count matching rows (without LIMIT/OFFSET)
  const countSql = `
    SELECT COUNT(*) AS total
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    ${whereSql}
  `;
  const [countRows] = await pool.execute(countSql, queryParams);
  const total = Number(countRows[0].total);

  // Fetch paginated rows
  const dataSql = `
    SELECT
      ${SAFE_STUDENT_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS}
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    ${whereSql}
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const dataParams = [...queryParams, Number(limit), Number(offset)];
  const [students] = await pool.execute(dataSql, dataParams);

  return { students, total };
}

/**
 * Find a single student by their students.id (UUID).
 * Returns null if not found.
 *
 * @param {string} id — students.id
 * @returns {object|null}
 */
async function findStudentById(id) {
  const sql = `
    SELECT
      ${SAFE_STUDENT_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS}
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
}

/**
 * Find a single student by their linked users.id (students.user_id).
 * Returns null if not found.
 *
 * @param {string} userId — users.id
 * @returns {object|null}
 */
async function findStudentByUserId(userId) {
  const sql = `
    SELECT
      ${SAFE_STUDENT_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS}
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.user_id = ?
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows[0] || null;
}

/**
 * Update allowed fields on a student record.
 * Uses a dynamic parameterized SET clause — safe, never uses string concatenation
 * of user-supplied values (only column names, which come from validated whitelist).
 *
 * @param {string} id       — students.id
 * @param {object} updates  — validated map of allowed fields → new values
 * @returns {object|null}   — updated student row, or null if not found
 */
async function updateStudent(id, updates) {
  const setClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`\`${key}\` = ?`);
    params.push(value);
  }

  if (setClauses.length === 0) return null;

  params.push(id);
  const sql = `UPDATE students SET ${setClauses.join(", ")} WHERE id = ?`;

  const [result] = await pool.execute(sql, params);
  if (result.affectedRows === 0) {
    return null;
  }

  // Re-fetch to return fresh data with JOIN
  return findStudentById(id);
}

module.exports = {
  findAllStudents,
  findStudentById,
  findStudentByUserId,
  updateStudent,
  createStudent,
};

/**
 * Create a new student with a coordinated users + students transaction.
 * Generates:
 *  - A UUID for users.id
 *  - A UUID for students.id
 *  - A unique student_id like STU20260001
 *
 * @param {{ name, email, password_hash, phone, first_name, last_name, date_of_birth, gender, blood_group, address, admission_date }} payload
 * @returns {object} Created student row
 */
async function createStudent(payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Generate user_id UUID
    const [[{ uuid: userId }]] = await conn.execute('SELECT UUID() AS uuid');

    // 2. Insert into users
    await conn.execute(
      `INSERT INTO users (id, name, email, password_hash, phone, role, status)
       VALUES (?, ?, ?, ?, ?, 'student', 'active')`,
      [userId, payload.name, payload.email, payload.password_hash, payload.phone || null]
    );

    // 3. Generate student UUID
    const [[{ uuid: studentId }]] = await conn.execute('SELECT UUID() AS uuid');

    // 4. Generate unique student_id (admission number)
    const year = new Date().getFullYear();
    const [[{ cnt }]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM students WHERE student_id LIKE ?`,
      [`STU${year}%`]
    );
    const seq = String(Number(cnt) + 1).padStart(4, '0');
    const studentCode = `STU${year}${seq}`;

    // 5. Insert into students
    await conn.execute(
      `INSERT INTO students
         (id, user_id, student_id, first_name, last_name, email, phone,
          date_of_birth, gender, blood_group, address, admission_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        studentId,
        userId,
        studentCode,
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.phone || null,
        payload.date_of_birth || null,
        payload.gender || null,
        payload.blood_group || null,
        payload.address || null,
        payload.admission_date || new Date().toISOString().slice(0, 10),
      ]
    );

    await conn.commit();

    // Re-fetch with JOIN to return full student object
    return findStudentById(studentId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
