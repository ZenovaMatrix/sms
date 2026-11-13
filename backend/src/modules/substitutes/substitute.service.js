"use strict";

const crypto = require("crypto");
const pool = require("../../config/db");
const repo = require("./substitute.repository");
const teacherRepo = require("../teachers/teacher.repository");
const classRepo = require("../classes/class.repository");
const sectionRepo = require("../sections/section.repository");
const subjectRepo = require("../subjects/subject.repository");
const auditRepo = require("../audit/audit.repository");
const ai = require("./substitute.ai");
const { validateId, validateAssignSubstitutePayload } = require("./substitute.validation");

async function getRecommendations(query) {
  const { teacher_id, class_id, section_id, subject_id, date } = query;

  if (!teacher_id || !class_id || !subject_id) {
    const err = new Error("teacher_id, class_id, and subject_id are required to generate substitute recommendations.");
    err.statusCode = 400;
    throw err;
  }

  const absentTeacherId = validateId(teacher_id, "teacher_id");
  const targetClassId = validateId(class_id, "class_id");
  const targetSubjectId = validateId(subject_id, "subject_id");

  // Load real records to validate existence
  const [absentTeacher, targetClass, targetSubject] = await Promise.all([
    teacherRepo.findTeacherById(absentTeacherId),
    classRepo.findById(targetClassId),
    subjectRepo.findById(targetSubjectId),
  ]);

  if (!absentTeacher) {
    const err = new Error("Absent teacher record not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!targetClass) {
    const err = new Error("Target class not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!targetSubject) {
    const err = new Error("Target subject not found.");
    err.statusCode = 404;
    throw err;
  }

  // Find candidate teachers
  const candidates = await repo.findAllCandidates({
    absentTeacherId,
    targetDate: date || new Date().toISOString().slice(0, 10),
  });

  const context = {
    absentTeacherName: `${absentTeacher.first_name} ${absentTeacher.last_name}`,
    targetClass,
    targetSubject,
    targetDepartmentId: absentTeacher.department_id,
    date: date || new Date().toISOString().slice(0, 10),
  };

  const ranked = await ai.generateRecommendations(candidates, context);

  return {
    context: {
      absent_teacher: context.absentTeacherName,
      class_name: targetClass.class_name,
      subject_name: targetSubject.subject_name,
      date: context.date,
    },
    recommendations: ranked,
  };
}

async function assignSubstitute(body, requester) {
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: only administrators can assign substitute teachers.");
    err.statusCode = 403;
    throw err;
  }

  const payload = validateAssignSubstitutePayload(body);

  // Real database verification of all entities
  const [origTeacher, subTeacher, targetClass, targetSection, targetSubject] = await Promise.all([
    teacherRepo.findTeacherById(payload.original_teacher_id),
    teacherRepo.findTeacherById(payload.substitute_teacher_id),
    classRepo.findById(payload.class_id),
    sectionRepo.findById(payload.section_id),
    subjectRepo.findById(payload.subject_id),
  ]);

  if (!origTeacher) {
    const err = new Error("Original teacher record not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!subTeacher) {
    const err = new Error("Substitute teacher record not found.");
    err.statusCode = 404;
    throw err;
  }
  if (subTeacher.status !== "active") {
    const err = new Error(`Substitute teacher is currently marked as '${subTeacher.status}' and cannot be assigned.`);
    err.statusCode = 400;
    throw err;
  }
  if (!targetClass) {
    const err = new Error("Class record not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!targetSection) {
    const err = new Error("Section record not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!targetSubject) {
    const err = new Error("Subject record not found.");
    err.statusCode = 404;
    throw err;
  }

  // Academic year resolution
  const [currentYear] = await pool.execute(`SELECT id FROM academic_years WHERE status = 'active' LIMIT 1`);
  const academic_year_id = currentYear[0]?.id || null;

  const id = crypto.randomUUID();
  const created = await repo.createSubstituteAssignment({
    id,
    ...payload,
    academic_year_id,
    created_by: requester.userId,
  });

  // Write audit log
  await auditRepo.createAuditLog({
    entity_type: "substitute_assignment",
    entity_id: id,
    action: "ASSIGN_SUBSTITUTE",
    user_id: requester.userId,
    user_role: requester.role,
    user_name: requester.userName || "Administrator",
    reason: payload.reason,
    new_values: {
      substitute_id: subTeacher.id,
      substitute_name: `${subTeacher.first_name} ${subTeacher.last_name}`,
      original_teacher_name: `${origTeacher.first_name} ${origTeacher.last_name}`,
      class: targetClass.class_name,
      section: targetSection.section_name,
      subject: targetSubject.subject_name,
      start_date: payload.start_date,
      end_date: payload.end_date,
    },
  });

  // Create official announcement / notification for affected faculty and students
  const notificationId = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO announcements
       (id, created_by, title, message, target_type, class_id, section_id, publish_date, status)
     VALUES (?, ?, ?, ?, 'section', ?, ?, NOW(), 'published')`,
    [
      notificationId,
      requester.userId,
      `Substitute Teacher Assignment: ${targetSubject.subject_name}`,
      `${subTeacher.first_name} ${subTeacher.last_name} has been assigned as substitute teacher covering ${targetSubject.subject_name} for ${targetClass.class_name} - Section ${targetSection.section_name} from ${payload.start_date} to ${payload.end_date}. Reason: ${payload.reason}.`,
      targetClass.id,
      targetSection.id,
    ]
  );

  return created;
}

async function getAllSubstitutes(query, requester) {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const status = query.status ? String(query.status).trim() : null;
  let teacher_id = query.teacher_id ? String(query.teacher_id).trim() : null;

  if (requester.role === "teacher") {
    const teacher = await teacherRepo.findTeacherByUserId(requester.userId);
    if (teacher) {
      teacher_id = teacher.id;
    }
  }

  const { substitutes, total } = await repo.findAllSubstituteAssignments({
    page,
    limit,
    status,
    teacher_id,
  });

  return {
    substitutes,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function updateStatus(idParam, body, requester) {
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: only administrators can update substitute assignment status.");
    err.statusCode = 403;
    throw err;
  }

  const id = validateId(idParam, "assignment_id");
  const existing = await repo.findSubstituteAssignmentById(id);
  if (!existing) {
    const err = new Error("Substitute assignment not found.");
    err.statusCode = 404;
    throw err;
  }

  const { status, notes } = body;
  const validStatuses = ["assigned", "active", "completed", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    const err = new Error(`status must be one of: ${validStatuses.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  const updated = await repo.updateSubstituteStatus(id, status, notes);

  await auditRepo.createAuditLog({
    entity_type: "substitute_assignment",
    entity_id: id,
    action: "UPDATE_STATUS",
    user_id: requester.userId,
    user_role: requester.role,
    user_name: requester.userName || "Administrator",
    reason: notes || `Status changed from ${existing.status} to ${status}`,
    old_values: { status: existing.status },
    new_values: { status, notes },
  });

  return updated;
}

module.exports = {
  getRecommendations,
  assignSubstitute,
  getAllSubstitutes,
  updateStatus,
};
