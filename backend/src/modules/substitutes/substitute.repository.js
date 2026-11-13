"use strict";

const pool = require("../../config/db");

async function findAllCandidates({ absentTeacherId, targetDate }) {
  // Query active teachers with their department, assigned subjects, and assigned classes
  const [teachers] = await pool.execute(
    `SELECT
       t.id,
       t.user_id,
       t.employee_id,
       t.department_id,
       t.first_name,
       t.last_name,
       t.phone,
       t.qualification,
       t.status,
       d.department_name
     FROM teachers t
     LEFT JOIN departments d ON d.id = t.department_id
     WHERE t.status = 'active' AND t.id != ?`,
    [absentTeacherId]
  );

  // For each candidate, load their assigned subjects and classes
  for (const teacher of teachers) {
    const [assignments] = await pool.execute(
      `SELECT
         ta.subject_id,
         sub.subject_name,
         ta.class_id,
         c.class_name,
         ta.section_id,
         sec.section_name
       FROM teacher_assignments ta
       JOIN subjects sub ON sub.id = ta.subject_id
       JOIN classes c ON c.id = ta.class_id
       JOIN sections sec ON sec.id = ta.section_id
       WHERE ta.teacher_id = ?`,
      [teacher.id]
    );

    teacher.assigned_subjects = assignments.map((a) => ({
      subject_id: a.subject_id,
      subject_name: a.subject_name,
    }));
    teacher.assigned_classes = assignments.map((a) => ({
      class_id: a.class_id,
      class_name: a.class_name,
    }));

    // Check conflict on target date if date is provided
    if (targetDate) {
      const [sessions] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM attendance_sessions s
         JOIN teacher_assignments ta ON ta.id = s.teacher_assignment_id
         WHERE ta.teacher_id = ? AND s.session_date = ?`,
        [teacher.id, targetDate]
      );
      const [activeSubs] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM substitute_assignments sa
         WHERE sa.substitute_teacher_id = ?
           AND sa.status = 'active'
           AND ? BETWEEN sa.start_date AND sa.end_date`,
        [teacher.id, targetDate]
      );
      teacher.has_conflict = Number(sessions[0].cnt) > 0 || Number(activeSubs[0].cnt) > 0;
    } else {
      teacher.has_conflict = false;
    }
  }

  return teachers;
}

async function createSubstituteAssignment(data) {
  const {
    id,
    original_teacher_id,
    substitute_teacher_id,
    class_id,
    section_id,
    subject_id,
    academic_year_id,
    start_date,
    end_date,
    reason,
    notes,
    created_by,
  } = data;

  await pool.execute(
    `INSERT INTO substitute_assignments
       (id, original_teacher_id, substitute_teacher_id, class_id, section_id, subject_id,
        academic_year_id, start_date, end_date, reason, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?)`,
    [
      id,
      original_teacher_id,
      substitute_teacher_id,
      class_id,
      section_id,
      subject_id,
      academic_year_id || null,
      start_date,
      end_date,
      reason,
      notes,
      created_by,
    ]
  );

  return findSubstituteAssignmentById(id);
}

async function findSubstituteAssignmentById(id) {
  const [rows] = await pool.execute(
    `SELECT
       sa.*,
       CONCAT(t_orig.first_name, ' ', t_orig.last_name) AS original_teacher_name,
       t_orig.employee_id AS original_employee_id,
       CONCAT(t_sub.first_name, ' ', t_sub.last_name) AS substitute_teacher_name,
       t_sub.employee_id AS substitute_employee_id,
       t_sub.phone AS substitute_phone,
       c.class_name,
       sec.section_name,
       sub.subject_name,
       sub.subject_code,
       u.name AS created_by_name
     FROM substitute_assignments sa
     JOIN teachers t_orig ON t_orig.id = sa.original_teacher_id
     JOIN teachers t_sub ON t_sub.id = sa.substitute_teacher_id
     JOIN classes c ON c.id = sa.class_id
     JOIN sections sec ON sec.id = sa.section_id
     JOIN subjects sub ON sub.id = sa.subject_id
     LEFT JOIN users u ON u.id = sa.created_by
     WHERE sa.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findAllSubstituteAssignments({ page = 1, limit = 20, status = null, teacher_id = null }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (status) {
    where.push("sa.status = ?");
    params.push(status);
  }
  if (teacher_id) {
    where.push("(sa.original_teacher_id = ? OR sa.substitute_teacher_id = ?)");
    params.push(teacher_id, teacher_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM substitute_assignments sa ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT
       sa.*,
       CONCAT(t_orig.first_name, ' ', t_orig.last_name) AS original_teacher_name,
       t_orig.employee_id AS original_employee_id,
       CONCAT(t_sub.first_name, ' ', t_sub.last_name) AS substitute_teacher_name,
       t_sub.employee_id AS substitute_employee_id,
       t_sub.phone AS substitute_phone,
       c.class_name,
       sec.section_name,
       sub.subject_name,
       sub.subject_code,
       u.name AS created_by_name
     FROM substitute_assignments sa
     JOIN teachers t_orig ON t_orig.id = sa.original_teacher_id
     JOIN teachers t_sub ON t_sub.id = sa.substitute_teacher_id
     JOIN classes c ON c.id = sa.class_id
     JOIN sections sec ON sec.id = sa.section_id
     JOIN subjects sub ON sub.id = sa.subject_id
     LEFT JOIN users u ON u.id = sa.created_by
     ${whereSql}
     ORDER BY sa.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { substitutes: rows, total: Number(total) };
}

async function updateSubstituteStatus(id, status, notes = null) {
  await pool.execute(
    `UPDATE substitute_assignments SET status = ?, notes = COALESCE(?, notes) WHERE id = ?`,
    [status, notes, id]
  );
  return findSubstituteAssignmentById(id);
}

module.exports = {
  findAllCandidates,
  createSubstituteAssignment,
  findSubstituteAssignmentById,
  findAllSubstituteAssignments,
  updateSubstituteStatus,
};

