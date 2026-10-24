"use strict";

const crypto = require("crypto");
const pool = require("../../config/db");
const repo = require("./correction.repository");
const teacherRepo = require("../teachers/teacher.repository");
const auditRepo = require("../audit/audit.repository");

function calculateGrade(marks, total, passing) {
  const pct = (marks / total) * 100;
  let grade = "F";
  if (pct >= 90) grade = "A+";
  else if (pct >= 80) grade = "A";
  else if (pct >= 70) grade = "B";
  else if (pct >= 60) grade = "C";
  else if (pct >= 50) grade = "D";

  const status = marks >= passing ? "pass" : "fail";
  return { grade, status };
}

async function createRequest(body, requester) {
  let teacherId = body.teacher_id;
  if (requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher) {
      const err = new Error("Teacher profile not found.");
      err.statusCode = 404;
      throw err;
    }
    teacherId = teacher.id;
  }

  if (!teacherId) {
    const err = new Error("Teacher ID is required.");
    err.statusCode = 400;
    throw err;
  }

  const {
    request_type,
    class_id,
    section_id,
    subject_id,
    target_id,
    target_date,
    proposed_changes,
    current_data,
    reason,
  } = body;

  if (!["attendance", "result"].includes(request_type)) {
    const err = new Error("request_type must be either 'attendance' or 'result'.");
    err.statusCode = 400;
    throw err;
  }

  if (!reason || typeof reason !== "string" || !reason.trim()) {
    const err = new Error("A reason explaining the correction request is required.");
    err.statusCode = 400;
    throw err;
  }

  if (!proposed_changes) {
    const err = new Error("proposed_changes object or array is required.");
    err.statusCode = 400;
    throw err;
  }

  const formattedDate = target_date
    ? (typeof target_date === "string" && target_date.includes("T") ? target_date.split("T")[0] : String(target_date).slice(0, 10))
    : null;

  const id = crypto.randomUUID();
  const created = await repo.createRequest({
    id,
    request_type,
    teacher_id: teacherId,
    class_id,
    section_id,
    subject_id,
    target_id,
    target_date: formattedDate,
    proposed_changes,
    current_data,
    reason: reason.trim(),
  });

  // Audit log of submission
  await auditRepo.createAuditLog({
    entity_type: "correction_requests",
    entity_id: id,
    action: "CREATE_CORRECTION_REQUEST",
    user_id: requester.userId,
    user_role: requester.role,
    user_name: requester.name || requester.email,
    new_values: created,
    reason: `Teacher submitted ${request_type} correction request: ${reason}`,
  });

  return created;
}

async function getRequests(query, requester) {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 50;
  const request_type = query.request_type || null;
  const status = query.status || null;

  let teacher_id = query.teacher_id || null;
  if (requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher) {
      const err = new Error("Teacher profile not found.");
      err.statusCode = 404;
      throw err;
    }
    teacher_id = teacher.id;
  }

  return repo.findAllRequests({
    teacher_id,
    request_type,
    status,
    page,
    limit,
  });
}

async function getRequestById(id, requester) {
  const request = await repo.findRequestById(id);
  if (!request) {
    const err = new Error("Correction request not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (!teacher || teacher.id !== request.teacher_id) {
      const err = new Error("Forbidden: you cannot view another teacher's correction request.");
      err.statusCode = 403;
      throw err;
    }
  }

  return request;
}

async function reviewRequest(id, body, requester) {
  const { status, admin_notes } = body;
  if (!["approved", "rejected"].includes(status)) {
    const err = new Error("Status must be either 'approved' or 'rejected'.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await repo.findRequestById(id);
  if (!existing) {
    const err = new Error("Correction request not found.");
    err.statusCode = 404;
    throw err;
  }

  if (existing.status !== "pending") {
    const err = new Error(`Request has already been ${existing.status}.`);
    err.statusCode = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (status === "approved") {
      if (existing.request_type === "attendance") {
        // Apply attendance changes
        const changes = Array.isArray(existing.proposed_changes)
          ? existing.proposed_changes
          : existing.proposed_changes.records || [existing.proposed_changes];

        for (const item of changes) {
          if (item.id) {
            // Updating specific attendance row
            const [oldRows] = await conn.execute("SELECT * FROM attendance WHERE id = ?", [item.id]);
            const oldRow = oldRows[0] || null;

            await conn.execute(
              "UPDATE attendance SET status = ?, remarks = ?, marked_at = CURRENT_TIMESTAMP WHERE id = ?",
              [item.status, item.remarks || null, item.id]
            );

            await auditRepo.createAuditLog(
              {
                entity_type: "attendance",
                entity_id: item.id,
                action: "CORRECTION_APPROVED_ATTENDANCE",
                user_id: requester.userId,
                user_role: requester.role,
                user_name: requester.name || requester.email,
                old_values: oldRow,
                new_values: item,
                reason: `Correction request ${id} approved: ${existing.reason}`,
              },
              conn
            );
          } else if (existing.target_id && item.student_id) {
            // Upsert attendance for target session
            const [oldRows] = await conn.execute(
              "SELECT * FROM attendance WHERE attendance_session_id = ? AND student_id = ?",
              [existing.target_id, item.student_id]
            );
            const oldRow = oldRows[0] || null;

            if (oldRow) {
              await conn.execute(
                "UPDATE attendance SET status = ?, remarks = ?, marked_at = CURRENT_TIMESTAMP WHERE id = ?",
                [item.status, item.remarks || null, oldRow.id]
              );
            } else {
              const newAttId = crypto.randomUUID();
              await conn.execute(
                "INSERT INTO attendance (id, attendance_session_id, student_id, status, remarks) VALUES (?, ?, ?, ?, ?)",
                [newAttId, existing.target_id, item.student_id, item.status, item.remarks || null]
              );
            }

            await auditRepo.createAuditLog(
              {
                entity_type: "attendance",
                entity_id: oldRow ? oldRow.id : existing.target_id,
                action: "CORRECTION_APPROVED_ATTENDANCE",
                user_id: requester.userId,
                user_role: requester.role,
                user_name: requester.name || requester.email,
                old_values: oldRow,
                new_values: item,
                reason: `Correction request ${id} approved: ${existing.reason}`,
              },
              conn
            );
          }
        }
      } else if (existing.request_type === "result") {
        // Apply result changes
        const resultId = existing.target_id;
        const [oldRows] = await conn.execute(
          `SELECT r.*, es.total_marks, es.passing_marks
           FROM results r
           JOIN exam_subjects es ON es.id = r.exam_subject_id
           WHERE r.id = ?`,
          [resultId]
        );

        if (!oldRows[0]) {
          const err = new Error(`Target result record '${resultId}' does not exist.`);
          err.statusCode = 404;
          throw err;
        }

        const oldRow = oldRows[0];
        const marksObtained = existing.proposed_changes.marks_obtained !== undefined
          ? Number(existing.proposed_changes.marks_obtained)
          : Number(oldRow.marks_obtained);
        const remarks = existing.proposed_changes.remarks !== undefined
          ? existing.proposed_changes.remarks
          : oldRow.remarks;

        const { grade, status: resultStatus } = calculateGrade(
          marksObtained,
          Number(oldRow.total_marks),
          Number(oldRow.passing_marks)
        );

        await conn.execute(
          `UPDATE results
           SET marks_obtained = ?, grade = ?, result_status = ?, remarks = ?
           WHERE id = ?`,
          [marksObtained, grade, resultStatus, remarks, resultId]
        );

        await auditRepo.createAuditLog(
          {
            entity_type: "results",
            entity_id: resultId,
            action: "CORRECTION_APPROVED_RESULT",
            user_id: requester.userId,
            user_role: requester.role,
            user_name: requester.name || requester.email,
            old_values: { marks_obtained: oldRow.marks_obtained, grade: oldRow.grade, result_status: oldRow.result_status },
            new_values: { marks_obtained: marksObtained, grade, result_status: resultStatus, remarks },
            reason: `Correction request ${id} approved: ${existing.reason}`,
          },
          conn
        );
      }
    }

    // Update the request itself
    await repo.reviewRequest(
      id,
      {
        status,
        admin_notes,
        reviewed_by: requester.userId,
      },
      conn
    );

    await auditRepo.createAuditLog(
      {
        entity_type: "correction_requests",
        entity_id: id,
        action: `CORRECTION_REQUEST_${status.toUpperCase()}`,
        user_id: requester.userId,
        user_role: requester.role,
        user_name: requester.name || requester.email,
        old_values: { status: existing.status },
        new_values: { status, admin_notes },
        reason: admin_notes || `Admin marked request as ${status}`,
      },
      conn
    );

    await conn.commit();
    return repo.findRequestById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  reviewRequest,
};
