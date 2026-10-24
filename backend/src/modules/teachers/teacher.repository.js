"use strict";

const pool = require("../../config/db");

/**
 * teacher.repository.js
 *
 * Direct database access layer for the Teachers module.
 *
 * Rules:
 *   - All queries use parameterized pool.execute() — NO raw string interpolation.
 *   - Never SELECT *; always name explicit, safe columns.
 *   - Never return or select password_hash from users.
 *   - No Express req/res here — pure data-access functions only.
 */

// Explicit safe column list for teachers
const SAFE_TEACHER_COLUMNS = `
  t.id,
  t.user_id,
  t.employee_id,
  t.department_id,
  t.first_name,
  t.last_name,
  t.phone,
  t.qualification,
  t.joining_date,
  t.status,
  t.created_at,
  t.updated_at
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

// Safe department columns joined
const SAFE_DEPT_JOIN_COLUMNS = `
  d.department_name AS department_name,
  d.department_code AS department_code
`;

/**
 * Fetch a paginated list of teachers with optional search.
 *
 * Search columns (from confirmed actual schema):
 *   - t.first_name
 *   - t.last_name
 *   - t.employee_id
 *   - t.qualification
 *   - t.phone
 *
 * @param {{ page: number, limit: number, search: string|null }} params
 * @returns {{ teachers: object[], total: number }}
 */
async function findAllTeachers({ page, limit, search }) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const queryParams = [];

  if (search && search.trim() !== "") {
    const pattern = `%${search.trim()}%`;
    whereClauses.push(
      "(t.first_name LIKE ? OR t.last_name LIKE ? OR t.employee_id LIKE ? OR t.qualification LIKE ? OR t.phone LIKE ?)"
    );
    queryParams.push(pattern, pattern, pattern, pattern, pattern);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Count matching rows
  const countSql = `
    SELECT COUNT(*) AS total
    FROM teachers t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN departments d ON t.department_id = d.id
    ${whereSql}
  `;
  const [countRows] = await pool.execute(countSql, queryParams);
  const total = Number(countRows[0].total);

  // Fetch paginated rows
  const dataSql = `
    SELECT
      ${SAFE_TEACHER_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS},
      ${SAFE_DEPT_JOIN_COLUMNS}
    FROM teachers t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN departments d ON t.department_id = d.id
    ${whereSql}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const dataParams = [...queryParams, Number(limit), Number(offset)];
  const [teachers] = await pool.execute(dataSql, dataParams);

  return { teachers, total };
}

/**
 * Find a single teacher by their teachers.id (UUID).
 *
 * @param {string} id - teachers.id
 * @returns {object|null}
 */
async function findTeacherById(id) {
  const sql = `
    SELECT
      ${SAFE_TEACHER_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS},
      ${SAFE_DEPT_JOIN_COLUMNS}
    FROM teachers t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN departments d ON t.department_id = d.id
    WHERE t.id = ?
  `;
  const [rows] = await pool.execute(sql, [id]);
  if (!rows[0]) return null;

  const teacher = rows[0];
  const [assignments] = await pool.execute(
    `SELECT
       ta.id AS assignment_id,
       ta.subject_id,
       sub.subject_name,
       sub.subject_code,
       ta.class_id,
       c.class_name,
       ta.section_id,
       sec.section_name,
       ta.academic_year_id,
       ay.year_name,
       (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = ta.class_id AND e.section_id = ta.section_id AND e.status = 'active') AS enrolled_students_count
     FROM teacher_assignments ta
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     JOIN academic_years ay ON ay.id = ta.academic_year_id
     WHERE ta.teacher_id = ?`,
    [id]
  );
  teacher.assignments = assignments || [];

  return teacher;
}

/**
 * Find a single teacher by their linked users.id (teachers.user_id).
 *
 * @param {string} userId - users.id
 * @returns {object|null}
 */
async function findTeacherByUserId(userId) {
  const sql = `
    SELECT
      ${SAFE_TEACHER_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS},
      ${SAFE_DEPT_JOIN_COLUMNS}
    FROM teachers t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN departments d ON t.department_id = d.id
    WHERE t.user_id = ?
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows[0] || null;
}

/**
 * Update allowed fields on a teacher record.
 * Uses parameterized SQL.
 *
 * @param {string} id - teachers.id
 * @param {object} updates - validated map of field -> value
 * @returns {object|null}
 */
async function updateTeacher(id, updates) {
  const setClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`\`${key}\` = ?`);
    params.push(value);
  }

  if (setClauses.length === 0) return null;

  params.push(id);
  const sql = `UPDATE teachers SET ${setClauses.join(", ")} WHERE id = ?`;

  const [result] = await pool.execute(sql, params);
  if (result.affectedRows === 0) {
    return null;
  }

  return findTeacherById(id);
}

module.exports = {
  findAllTeachers,
  findTeacherById,
  findTeacherByUserId,
  updateTeacher,
  createTeacher,
};

/**
 * Create a new teacher with coordinated users + teachers transaction.
 *
 * @param {{ name, email, password_hash, phone, first_name, last_name, department_id, qualification, joining_date }} payload
 * @returns {object} Created teacher record
 */
async function createTeacher(payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Generate user UUID
    const [[{ uuid: userId }]] = await conn.execute('SELECT UUID() AS uuid');

    // 2. Insert into users
    await conn.execute(
      `INSERT INTO users (id, name, email, password_hash, phone, role, status)
       VALUES (?, ?, ?, ?, ?, 'teacher', 'active')`,
      [userId, payload.name, payload.email, payload.password_hash, payload.phone || null]
    );

    // 3. Generate teacher UUID
    const [[{ uuid: teacherId }]] = await conn.execute('SELECT UUID() AS uuid');

    // 4. Generate unique employee_id
    const year = new Date().getFullYear();
    const [[{ cnt }]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM teachers WHERE employee_id LIKE ?`,
      [`EMP${year}%`]
    );
    const seq = String(Number(cnt) + 1).padStart(4, '0');
    const employeeCode = `EMP${year}${seq}`;

    // 5. Insert into teachers
    await conn.execute(
      `INSERT INTO teachers
         (id, user_id, employee_id, department_id, first_name, last_name, phone,
          qualification, joining_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        teacherId,
        userId,
        employeeCode,
        payload.department_id || null,
        payload.first_name,
        payload.last_name,
        payload.phone || null,
        payload.qualification || null,
        payload.joining_date || new Date().toISOString().slice(0, 10),
      ]
    );

    await conn.commit();
    return findTeacherById(teacherId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function removeTeacher(id) {
  const [result] = await pool.execute(`DELETE FROM teachers WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  findAllTeachers,
  findTeacherById,
  findTeacherByUserId,
  updateTeacher,
  createTeacher,
  removeTeacher,
};
