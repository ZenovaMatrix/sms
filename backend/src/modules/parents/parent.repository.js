"use strict";

const pool = require("../../config/db");

/**
 * parent.repository.js
 *
 * Direct database access layer for Parents & Student-Parent Relationships.
 *
 * Rules:
 *   - All queries use parameterized pool.execute()
 *   - Never SELECT *; always name explicit, safe columns
 *   - Never return or select password_hash
 */

// Explicit safe columns from parents_guardians
const SAFE_PARENT_COLUMNS = `
  p.id,
  p.user_id,
  p.full_name,
  p.phone,
  p.email,
  p.occupation,
  p.address,
  p.created_at,
  p.updated_at
`;

// Safe user columns joined
const SAFE_USER_JOIN_COLUMNS = `
  u.id        AS linked_user_id,
  u.name      AS linked_user_name,
  u.email     AS linked_user_email,
  u.phone     AS linked_user_phone,
  u.status    AS linked_user_status,
  u.role      AS linked_user_role
`;

// Safe student columns for relationship queries
const SAFE_LINKED_STUDENT_COLUMNS = `
  s.id AS student_id,
  s.user_id AS student_user_id,
  s.student_id AS student_admission_id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.gender,
  s.date_of_birth,
  s.status
`;

/**
 * Fetch a paginated list of parents with optional search.
 *
 * @param {{ page: number, limit: number, search: string|null }} params
 * @returns {{ parents: object[], total: number }}
 */
async function findAllParents({ page, limit, search, class_id, section_id, student_id }) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const queryParams = [];

  if (search && search.trim() !== "") {
    const pattern = `%${search.trim()}%`;
    whereClauses.push(
      "(p.full_name LIKE ? OR p.phone LIKE ? OR p.email LIKE ? OR p.occupation LIKE ?)"
    );
    queryParams.push(pattern, pattern, pattern, pattern);
  }

  if (student_id) {
    whereClauses.push("p.id IN (SELECT sp.parent_id FROM student_parents sp WHERE sp.student_id = ?)");
    queryParams.push(student_id);
  } else if (section_id) {
    whereClauses.push("p.id IN (SELECT sp.parent_id FROM student_parents sp JOIN enrollments e ON sp.student_id = e.student_id WHERE e.section_id = ?)");
    queryParams.push(section_id);
  } else if (class_id) {
    whereClauses.push("p.id IN (SELECT sp.parent_id FROM student_parents sp JOIN enrollments e ON sp.student_id = e.student_id WHERE e.class_id = ?)");
    queryParams.push(class_id);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM parents_guardians p
    LEFT JOIN users u ON p.user_id = u.id
    ${whereSql}
  `;
  const [countRows] = await pool.execute(countSql, queryParams);
  const total = Number(countRows[0].total);

  const dataSql = `
    SELECT
      ${SAFE_PARENT_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS},
      (SELECT COUNT(*) FROM student_parents sp WHERE sp.parent_id = p.id) AS linked_children_count
    FROM parents_guardians p
    LEFT JOIN users u ON p.user_id = u.id
    ${whereSql}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const dataParams = [...queryParams, Number(limit), Number(offset)];
  const [parents] = await pool.execute(dataSql, dataParams);

  return { parents, total };
}

/**
 * Find parent by ID.
 * @param {string} id
 * @returns {object|null}
 */
async function findParentById(id) {
  const sql = `
    SELECT
      ${SAFE_PARENT_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS}
    FROM parents_guardians p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0] || null;
}

/**
 * Find parent by linked user_id.
 * @param {string} userId
 * @returns {object|null}
 */
async function findParentByUserId(userId) {
  const sql = `
    SELECT
      ${SAFE_PARENT_COLUMNS},
      ${SAFE_USER_JOIN_COLUMNS}
    FROM parents_guardians p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows[0] || null;
}

/**
 * Update allowed fields on a parent record.
 * @param {string} id
 * @param {object} updates
 * @returns {object|null}
 */
async function updateParent(id, updates) {
  const setClauses = [];
  const params = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`\`${key}\` = ?`);
    params.push(value);
  }

  if (setClauses.length === 0) return null;

  params.push(id);
  const sql = `UPDATE parents_guardians SET ${setClauses.join(", ")} WHERE id = ?`;

  const [result] = await pool.execute(sql, params);
  if (result.affectedRows === 0) {
    return null;
  }

  return findParentById(id);
}

/**
 * Find all students linked to a parent through student_parents.
 *
 * @param {string} parentId
 * @returns {object[]}
 */
async function findStudentsByParentId(parentId) {
  const sql = `
    SELECT
      sp.id AS relationship_id,
      sp.relationship,
      sp.is_primary_contact,
      sp.is_emergency_contact,
      sp.created_at AS linked_at,
      ${SAFE_LINKED_STUDENT_COLUMNS},
      c.id AS class_id,
      c.class_name,
      sec.id AS section_id,
      sec.section_name,
      e.status AS enrollment_status
    FROM student_parents sp
    INNER JOIN students s ON sp.student_id = s.id
    LEFT JOIN (
      SELECT e1.student_id, e1.class_id, e1.section_id, e1.status
      FROM enrollments e1
      WHERE e1.id IN (
        SELECT SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY created_at DESC), ',', 1)
        FROM enrollments
        GROUP BY student_id
      )
    ) e ON s.id = e.student_id
    LEFT JOIN classes c ON e.class_id = c.id
    LEFT JOIN sections sec ON e.section_id = sec.id
    WHERE sp.parent_id = ?
    ORDER BY sp.created_at ASC
  `;
  const [rows] = await pool.execute(sql, [parentId]);
  return rows;
}

/**
 * Find all parents linked to a student through student_parents.
 *
 * @param {string} studentId
 * @returns {object[]}
 */
async function findParentsByStudentId(studentId) {
  const sql = `
    SELECT
      sp.id AS relationship_id,
      sp.relationship,
      sp.is_primary_contact,
      sp.is_emergency_contact,
      sp.created_at AS linked_at,
      ${SAFE_PARENT_COLUMNS}
    FROM student_parents sp
    INNER JOIN parents_guardians p ON sp.parent_id = p.id
    WHERE sp.student_id = ?
    ORDER BY sp.created_at ASC
  `;
  const [rows] = await pool.execute(sql, [studentId]);
  return rows;
}

/**
 * Check if a relationship between a student and parent already exists.
 *
 * @param {string} parentId
 * @param {string} studentId
 * @returns {object|null}
 */
async function findRelationship(parentId, studentId) {
  const sql = `
    SELECT id, student_id, parent_id, relationship, is_primary_contact, is_emergency_contact, created_at
    FROM student_parents
    WHERE parent_id = ? AND student_id = ?
  `;
  const [rows] = await pool.execute(sql, [parentId, studentId]);
  return rows[0] || null;
}

/**
 * Insert a new student-parent relationship.
 *
 * @param {{ id: string, parentId: string, studentId: string, relationship: string, isPrimaryContact: number, isEmergencyContact: number }} data
 * @returns {object}
 */
async function createRelationship({ id, parentId, studentId, relationship, isPrimaryContact, isEmergencyContact }) {
  const sql = `
    INSERT INTO student_parents (id, student_id, parent_id, relationship, is_primary_contact, is_emergency_contact)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  await pool.execute(sql, [id, studentId, parentId, relationship, isPrimaryContact, isEmergencyContact]);

  return findRelationship(parentId, studentId);
}

/**
 * Create a new parent record with linked user account atomically in a transaction.
 *
 * @param {{ user: object, parent: object }} data
 * @returns {object}
 */
async function createParent({ user, parent }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userSql = `
      INSERT INTO users (id, name, email, password_hash, role, phone, status)
      VALUES (?, ?, ?, ?, 'parent', ?, 'active')
    `;
    await connection.execute(userSql, [
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.phone || null,
    ]);

    const parentSql = `
      INSERT INTO parents_guardians (id, user_id, full_name, phone, email, occupation, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await connection.execute(parentSql, [
      parent.id,
      user.id,
      parent.fullName,
      parent.phone || null,
      parent.email,
      parent.occupation || null,
      parent.address || null,
    ]);

    await connection.commit();
    return findParentById(parent.id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteRelationship(parentId, studentId) {
  const sql = `DELETE FROM student_parents WHERE parent_id = ? AND student_id = ?`;
  const [result] = await pool.execute(sql, [parentId, studentId]);
  return result.affectedRows > 0;
}

async function setUserStatus(userId, status) {
  const sql = `UPDATE users SET status = ? WHERE id = ?`;
  const [result] = await pool.execute(sql, [status, userId]);
  return result.affectedRows > 0;
}

module.exports = {
  findAllParents,
  findParentById,
  findParentByUserId,
  createParent,
  updateParent,
  findStudentsByParentId,
  findParentsByStudentId,
  findRelationship,
  createRelationship,
  deleteRelationship,
  setUserStatus,
};
