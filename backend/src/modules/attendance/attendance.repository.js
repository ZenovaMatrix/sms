"use strict";

const pool = require("../../config/db");

const SESSION_COLS = `
  ats.id,
  ats.teacher_assignment_id,
  ta.teacher_id,
  t.first_name AS teacher_first_name,
  t.last_name AS teacher_last_name,
  t.user_id AS teacher_user_id,
  ta.subject_id,
  sub.subject_name,
  ta.class_id,
  c.class_name,
  ta.section_id,
  sec.section_name,
  DATE_FORMAT(ats.session_date, '%Y-%m-%d') AS session_date,
  ats.start_time,
  ats.end_time,
  ats.created_at
`;

const ATTENDANCE_COLS = `
  att.id,
  att.attendance_session_id,
  att.student_id,
  s.student_id AS student_number,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  s.user_id AS student_user_id,
  DATE_FORMAT(ats.session_date, '%Y-%m-%d') AS session_date,
  ats.start_time,
  ats.end_time,
  ta.subject_id,
  sub.subject_name,
  ta.class_id,
  c.class_name,
  ta.section_id,
  sec.section_name,
  ta.teacher_id,
  t.user_id AS teacher_user_id,
  att.status,
  att.remarks,
  att.marked_at
`;

// ─── SESSIONS REPOSITORY ──────────────────────────────────────────────────────

async function findAllSessions({
  page = 1,
  limit = 20,
  teacher_assignment_id = null,
  teacher_id = null,
  class_id = null,
  section_id = null,
  subject_id = null,
  session_date = null,
}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (teacher_assignment_id) {
    where.push("ats.teacher_assignment_id = ?");
    params.push(teacher_assignment_id);
  }
  if (teacher_id) {
    where.push("ta.teacher_id = ?");
    params.push(teacher_id);
  }
  if (class_id) {
    where.push("ta.class_id = ?");
    params.push(class_id);
  }
  if (section_id) {
    where.push("ta.section_id = ?");
    params.push(section_id);
  }
  if (subject_id) {
    where.push("ta.subject_id = ?");
    params.push(subject_id);
  }
  if (session_date) {
    where.push("ats.session_date = ?");
    params.push(session_date);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM attendance_sessions ats
     JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${SESSION_COLS} FROM attendance_sessions ats
     JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     ${whereSql}
     ORDER BY ats.session_date DESC, ats.start_time DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { sessions: rows, total: Number(total) };
}

async function findSessionById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SESSION_COLS} FROM attendance_sessions ats
     JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     WHERE ats.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findDuplicateSession(teacher_assignment_id, session_date, start_time) {
  const [rows] = await pool.execute(
    `SELECT id FROM attendance_sessions
     WHERE teacher_assignment_id = ? AND session_date = ? AND start_time = ?`,
    [teacher_assignment_id, session_date, start_time]
  );
  return rows[0] || null;
}

async function createSession({ id, teacher_assignment_id, session_date, start_time, end_time }) {
  await pool.execute(
    `INSERT INTO attendance_sessions (id, teacher_assignment_id, session_date, start_time, end_time)
     VALUES (?, ?, ?, ?, ?)`,
    [id, teacher_assignment_id, session_date, start_time, end_time || null]
  );
  return findSessionById(id);
}

async function updateSession(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    sets.push(`\`${k}\` = ?`);
    params.push(v);
  }
  if (!sets.length) return findSessionById(id);
  params.push(id);
  await pool.execute(`UPDATE attendance_sessions SET ${sets.join(", ")} WHERE id = ?`, params);
  return findSessionById(id);
}

async function removeSession(id) {
  const [result] = await pool.execute(`DELETE FROM attendance_sessions WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countSessionAttendance(id) {
  const [[{ cnt }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM attendance WHERE attendance_session_id = ?`,
    [id]
  );
  return Number(cnt);
}

// ─── ATTENDANCE RECORDS REPOSITORY ───────────────────────────────────────────

async function findAllAttendance({
  page = 1,
  limit = 20,
  attendance_session_id = null,
  student_id = null,
  teacher_id = null,
  class_id = null,
  section_id = null,
  subject_id = null,
  status = null,
  start_date = null,
  end_date = null,
}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (attendance_session_id) {
    where.push("att.attendance_session_id = ?");
    params.push(attendance_session_id);
  }
  if (student_id) {
    where.push("att.student_id = ?");
    params.push(student_id);
  }
  if (teacher_id) {
    where.push("ta.teacher_id = ?");
    params.push(teacher_id);
  }
  if (class_id) {
    where.push("ta.class_id = ?");
    params.push(class_id);
  }
  if (section_id) {
    where.push("ta.section_id = ?");
    params.push(section_id);
  }
  if (subject_id) {
    where.push("ta.subject_id = ?");
    params.push(subject_id);
  }
  if (status) {
    where.push("att.status = ?");
    params.push(status);
  }
  if (start_date) {
    where.push("ats.session_date >= ?");
    params.push(start_date);
  }
  if (end_date) {
    where.push("ats.session_date <= ?");
    params.push(end_date);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM attendance att
     JOIN attendance_sessions ats ON ats.id = att.attendance_session_id
     JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     JOIN students s ON s.id = att.student_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${ATTENDANCE_COLS} FROM attendance att
     JOIN attendance_sessions ats ON ats.id = att.attendance_session_id
     JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     JOIN students s ON s.id = att.student_id
     ${whereSql}
     ORDER BY ats.session_date DESC, att.marked_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { attendance: rows, total: Number(total) };
}

async function findAttendanceById(id) {
  const [rows] = await pool.execute(
    `SELECT ${ATTENDANCE_COLS} FROM attendance att
     JOIN attendance_sessions ats ON ats.id = att.attendance_session_id
     JOIN teacher_assignments ta ON ta.id = ats.teacher_assignment_id
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN subjects sub ON sub.id = ta.subject_id
     JOIN classes c ON c.id = ta.class_id
     JOIN sections sec ON sec.id = ta.section_id
     JOIN students s ON s.id = att.student_id
     WHERE att.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findAttendanceBySessionAndStudent(sessionId, studentId) {
  const [rows] = await pool.execute(
    `SELECT id, status FROM attendance
     WHERE attendance_session_id = ? AND student_id = ?`,
    [sessionId, studentId]
  );
  return rows[0] || null;
}

async function createAttendance({ id, attendance_session_id, student_id, status, remarks }) {
  await pool.execute(
    `INSERT INTO attendance (id, attendance_session_id, student_id, status, remarks)
     VALUES (?, ?, ?, ?, ?)`,
    [id, attendance_session_id, student_id, status, remarks || null]
  );
  return findAttendanceById(id);
}

async function updateAttendance(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    sets.push(`\`${k}\` = ?`);
    params.push(v);
  }
  if (!sets.length) return findAttendanceById(id);
  params.push(id);
  await pool.execute(`UPDATE attendance SET ${sets.join(", ")} WHERE id = ?`, params);
  return findAttendanceById(id);
}

async function removeAttendance(id) {
  const [result] = await pool.execute(`DELETE FROM attendance WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

// ─── BULK ATTENDANCE (TRANSACTIONAL) ──────────────────────────────────────────

async function saveBulkAttendance(sessionId, records) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const rec of records) {
      await conn.execute(
        `INSERT INTO attendance (id, attendance_session_id, student_id, status, remarks)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), remarks = VALUES(remarks), marked_at = CURRENT_TIMESTAMP`,
        [rec.id, sessionId, rec.student_id, rec.status, rec.remarks || null]
      );
    }

    await conn.commit();
    return { count: records.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── STUDENT SUMMARY ──────────────────────────────────────────────────────────

async function getStudentAttendanceSummary(studentId) {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_sessions,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count,
       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
       SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count,
       SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) AS excused_count
     FROM attendance
     WHERE student_id = ?`,
    [studentId]
  );

  const row = rows[0] || {};
  const total = Number(row.total_sessions) || 0;
  const present = Number(row.present_count) || 0;
  const absent = Number(row.absent_count) || 0;
  const late = Number(row.late_count) || 0;
  const excused = Number(row.excused_count) || 0;

  const percentage = total > 0 ? Number(((present / total) * 100).toFixed(2)) : 0.0;

  return {
    student_id: studentId,
    total_sessions: total,
    present_count: present,
    absent_count: absent,
    late_count: late,
    excused_count: excused,
    attendance_percentage: percentage,
  };
}

module.exports = {
  findAllSessions,
  findSessionById,
  findDuplicateSession,
  createSession,
  updateSession,
  removeSession,
  countSessionAttendance,
  findAllAttendance,
  findAttendanceById,
  findAttendanceBySessionAndStudent,
  createAttendance,
  updateAttendance,
  removeAttendance,
  saveBulkAttendance,
  getStudentAttendanceSummary,
};
