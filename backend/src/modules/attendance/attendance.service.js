"use strict";

const crypto = require("crypto");
const pool = require("../../config/db");
const repo = require("./attendance.repository");
const teacherRepo = require("../teachers/teacher.repository");
const taRepo = require("../teacherAssignments/teacherAssignment.repository");
const studentRepo = require("../students/student.repository");
const deadlineService = require("../deadlines/deadline.service");
const auditRepo = require("../audit/audit.repository");
const {
  validateId,
  validatePagination,
  validateCreateSession,
  validatePatchSession,
  validateCreateAttendance,
  validatePatchAttendance,
  validateBulkAttendance,
} = require("./attendance.validation");

async function isParentLinkedToStudent(parentUserId, studentId) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM student_parents sp
     JOIN parents_guardians pg ON pg.id = sp.parent_id
     WHERE pg.user_id = ? AND sp.student_id = ?`,
    [parentUserId, studentId]
  );
  return rows.length > 0;
}

// ─── SESSIONS SERVICE ─────────────────────────────────────────────────────────

async function getAllSessions(query, requester) {
  const { page, limit } = validatePagination(query);
  let teacher_id = query.teacher_id ? String(query.teacher_id).trim() : null;
  const teacher_assignment_id = query.teacher_assignment_id ? String(query.teacher_assignment_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const subject_id = query.subject_id ? String(query.subject_id).trim() : null;
  const session_date = query.session_date ? String(query.session_date).trim() : null;

  if (requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher) {
      const err = new Error("Teacher profile not found.");
      err.statusCode = 404;
      throw err;
    }
    teacher_id = teacher.id;
  }

  const { sessions, total } = await repo.findAllSessions({
    page,
    limit,
    teacher_assignment_id,
    teacher_id,
    class_id,
    section_id,
    subject_id,
    session_date,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    sessions,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

async function getSessionById(idParam, requester) {
  const id = validateId(idParam);
  const session = await repo.findSessionById(id);
  if (!session) {
    const err = new Error("Attendance session not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "teacher") {
    if (session.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you are not authorized to view this session.");
      err.statusCode = 403;
      throw err;
    }
  }

  return session;
}

async function createSession(body, requester) {
  const data = validateCreateSession(body);

  const assignment = await taRepo.findById(data.teacher_assignment_id);
  if (!assignment) {
    const err = new Error("Referenced teacher assignment does not exist.");
    err.statusCode = 400;
    throw err;
  }

  if (requester.role === "teacher") {
    if (assignment.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you can only create sessions for your own assignments.");
      err.statusCode = 403;
      throw err;
    }
    const win = await deadlineService.checkAttendanceWindow(data.session_date);
    if (!win.isOpen) {
      const err = new Error(`Forbidden: Attendance window is closed (${win.reason}). Please submit a Correction Request for admin approval.`);
      err.statusCode = 403;
      throw err;
    }
  }

  const duplicate = await repo.findDuplicateSession(
    data.teacher_assignment_id,
    data.session_date,
    data.start_time
  );
  if (duplicate) {
    const err = new Error("An attendance session for this assignment, date, and start time already exists.");
    err.statusCode = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  const created = await repo.createSession({ id, ...data });

  if (requester.userId) {
    await auditRepo.createAuditLog({
      entity_type: "attendance_sessions",
      entity_id: id,
      action: "CREATE_SESSION",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.name || requester.email,
      new_values: created,
      reason: `Created session for date ${data.session_date}`,
    });
  }

  return created;
}

async function patchSession(idParam, body, requester) {
  const id = validateId(idParam);
  const existing = await repo.findSessionById(id);
  if (!existing) {
    const err = new Error("Attendance session not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "teacher") {
    if (existing.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you cannot edit another teacher's session.");
      err.statusCode = 403;
      throw err;
    }
  }

  const updates = validatePatchSession(body);
  const targetDate = updates.session_date || existing.session_date;
  const targetStart = updates.start_time || existing.start_time;

  if (requester.role === "teacher") {
    const win = await deadlineService.checkAttendanceWindow(targetDate);
    if (!win.isOpen) {
      const err = new Error(`Forbidden: Attendance window is closed (${win.reason}). Please submit a Correction Request for admin approval.`);
      err.statusCode = 403;
      throw err;
    }
  }

  if (updates.session_date || updates.start_time) {
    const duplicate = await repo.findDuplicateSession(
      existing.teacher_assignment_id,
      targetDate,
      targetStart
    );
    if (duplicate && duplicate.id !== id) {
      const err = new Error("An attendance session for this assignment, date, and start time already exists.");
      err.statusCode = 409;
      throw err;
    }
  }

  return repo.updateSession(id, updates);
}

async function removeSession(idParam, requester) {
  const id = validateId(idParam);
  const existing = await repo.findSessionById(id);
  if (!existing) {
    const err = new Error("Attendance session not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "teacher") {
    if (existing.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you cannot delete another teacher's session.");
      err.statusCode = 403;
      throw err;
    }
  }

  const count = await repo.countSessionAttendance(id);
  if (count > 0) {
    const err = new Error(`Cannot delete session: contains ${count} attendance record(s).`);
    err.statusCode = 409;
    throw err;
  }

  await repo.removeSession(id);
  return { message: "Attendance session deleted successfully." };
}

// ─── ATTENDANCE RECORDS SERVICE ───────────────────────────────────────────────

async function getAllAttendance(query, requester) {
  const { page, limit } = validatePagination(query);
  const attendance_session_id = query.attendance_session_id ? String(query.attendance_session_id).trim() : null;
  let student_id = query.student_id ? String(query.student_id).trim() : null;
  let teacher_id = query.teacher_id ? String(query.teacher_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const subject_id = query.subject_id ? String(query.subject_id).trim() : null;
  const status = query.status ? String(query.status).trim() : null;
  const date = query.date ? String(query.date).trim() : null;
  const start_date = query.start_date ? String(query.start_date).trim() : (date || null);
  const end_date = query.end_date ? String(query.end_date).trim() : (date || null);

  if (requester.role === "student") {
    const student = await studentRepo.findStudentByUserId(requester.userId);
    if (!student) {
      const err = new Error("Student profile not found.");
      err.statusCode = 404;
      throw err;
    }
    student_id = student.id;
  } else if (requester.role === "parent") {
    if (student_id) {
      const linked = await isParentLinkedToStudent(requester.userId, student_id);
      if (!linked) {
        const err = new Error("Forbidden: student is not linked to your parent account.");
        err.statusCode = 403;
        throw err;
      }
    } else {
      const [links] = await pool.execute(
        `SELECT sp.student_id FROM student_parents sp
         JOIN parents_guardians pg ON pg.id = sp.parent_id
         WHERE pg.user_id = ?`,
        [requester.userId]
      );
      if (links.length === 0) {
        return { attendance: [], pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
      }
      if (links.length === 1) {
        student_id = links[0].student_id;
      }
    }
  } else if (requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher) {
      const err = new Error("Teacher profile not found.");
      err.statusCode = 404;
      throw err;
    }
    teacher_id = teacher.id;
  }

  const { attendance, total } = await repo.findAllAttendance({
    page,
    limit,
    attendance_session_id,
    student_id,
    teacher_id,
    class_id,
    section_id,
    subject_id,
    status,
    start_date,
    end_date,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    attendance,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

async function getAttendanceById(idParam, requester) {
  const id = validateId(idParam);
  const record = await repo.findAttendanceById(id);
  if (!record) {
    const err = new Error("Attendance record not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "student") {
    if (record.student_user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only view your own attendance records.");
      err.statusCode = 403;
      throw err;
    }
  } else if (requester.role === "parent") {
    const linked = await isParentLinkedToStudent(requester.userId, record.student_id);
    if (!linked) {
      const err = new Error("Forbidden: attendance record does not belong to a linked student.");
      err.statusCode = 403;
      throw err;
    }
  } else if (requester.role === "teacher") {
    if (record.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only view attendance records for your assignments.");
      err.statusCode = 403;
      throw err;
    }
  }

  return record;
}

async function createAttendance(body, requester) {
  const data = validateCreateAttendance(body);

  const session = await repo.findSessionById(data.attendance_session_id);
  if (!session) {
    const err = new Error("Referenced attendance session does not exist.");
    err.statusCode = 400;
    throw err;
  }

  if (requester.role === "teacher") {
    if (session.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you cannot record attendance for another teacher's session.");
      err.statusCode = 403;
      throw err;
    }
    const win = await deadlineService.checkAttendanceWindow(session.session_date);
    if (!win.isOpen) {
      const err = new Error(`Forbidden: Attendance window is closed (${win.reason}). Please submit a Correction Request for admin approval.`);
      err.statusCode = 403;
      throw err;
    }
  }

  const student = await studentRepo.findStudentById(data.student_id);
  if (!student) {
    const err = new Error("Referenced student does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await repo.findAttendanceBySessionAndStudent(
    data.attendance_session_id,
    data.student_id
  );
  if (duplicate) {
    const err = new Error("Attendance for this student in this session is already recorded.");
    err.statusCode = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  const created = await repo.createAttendance({ id, ...data });

  if (requester.userId) {
    await auditRepo.createAuditLog({
      entity_type: "attendance",
      entity_id: id,
      action: "CREATE_ATTENDANCE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.name || requester.email,
      new_values: created,
      reason: `Marked attendance for student ${data.student_id}`,
    });
  }

  return created;
}

async function patchAttendance(idParam, body, requester) {
  const id = validateId(idParam);
  const existing = await repo.findAttendanceById(id);
  if (!existing) {
    const err = new Error("Attendance record not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "teacher") {
    if (existing.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you cannot edit attendance for another teacher's session.");
      err.statusCode = 403;
      throw err;
    }
    const session = await repo.findSessionById(existing.attendance_session_id);
    const win = await deadlineService.checkAttendanceWindow(session ? session.session_date : null);
    if (!win.isOpen) {
      const err = new Error(`Forbidden: Attendance window is closed (${win.reason}). Please submit a Correction Request for admin approval.`);
      err.statusCode = 403;
      throw err;
    }
  }

  const updates = validatePatchAttendance(body);
  const updated = await repo.updateAttendance(id, updates);

  if (requester.userId) {
    await auditRepo.createAuditLog({
      entity_type: "attendance",
      entity_id: id,
      action: "UPDATE_ATTENDANCE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.name || requester.email,
      old_values: { status: existing.status, remarks: existing.remarks },
      new_values: updates,
      reason: `Updated attendance status to ${updates.status || existing.status}`,
    });
  }

  return updated;
}

async function saveBulk(body, requester) {
  const { attendance_session_id, records } = validateBulkAttendance(body);

  const session = await repo.findSessionById(attendance_session_id);
  if (!session) {
    const err = new Error("Referenced attendance session does not exist.");
    err.statusCode = 400;
    throw err;
  }

  if (requester.role === "teacher") {
    if (session.teacher_user_id !== requester.userId) {
      const err = new Error("Forbidden: you cannot record attendance for another teacher's session.");
      err.statusCode = 403;
      throw err;
    }
    const win = await deadlineService.checkAttendanceWindow(session.session_date);
    if (!win.isOpen) {
      const err = new Error(`Forbidden: Attendance window is closed (${win.reason}). Please submit a Correction Request for admin approval.`);
      err.statusCode = 403;
      throw err;
    }
  }

  // Validate all students belong to the class/section of this session
  for (const r of records) {
    const student = await studentRepo.findStudentById(r.student_id);
    if (!student) {
      const err = new Error(`Student '${r.student_id}' does not exist.`);
      err.statusCode = 400;
      throw err;
    }
    r.id = crypto.randomUUID();
  }

  await repo.saveBulkAttendance(attendance_session_id, records);

  if (requester.userId) {
    await auditRepo.createAuditLog({
      entity_type: "attendance",
      entity_id: attendance_session_id,
      action: "SAVE_BULK_ATTENDANCE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.name || requester.email,
      new_values: { count: records.length, session_id: attendance_session_id },
      reason: `Recorded bulk attendance for ${records.length} student(s)`,
    });
  }

  return { message: `Bulk attendance saved successfully for ${records.length} student(s).` };
}

// ─── SUMMARY SERVICE ──────────────────────────────────────────────────────────

async function getStudentSummary(studentIdParam, requester) {
  const studentId = validateId(studentIdParam);

  const student = await studentRepo.findStudentById(studentId);
  if (!student) {
    const err = new Error("Student not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "student") {
    if (student.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only view your own attendance summary.");
      err.statusCode = 403;
      throw err;
    }
  } else if (requester.role === "parent") {
    const linked = await isParentLinkedToStudent(requester.userId, studentId);
    if (!linked) {
      const err = new Error("Forbidden: student is not linked to your parent account.");
      err.statusCode = 403;
      throw err;
    }
  }

  return repo.getStudentAttendanceSummary(studentId);
}

module.exports = {
  getAllSessions,
  getSessionById,
  createSession,
  patchSession,
  removeSession,
  getAllAttendance,
  getAttendanceById,
  createAttendance,
  patchAttendance,
  saveBulk,
  getStudentSummary,
};
