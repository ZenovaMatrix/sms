"use strict";

const crypto = require("crypto");
const pool = require("../../config/db");
const repo = require("./fee.repository");
const studentRepo = require("../students/student.repository");
const ayRepo = require("../academicYears/academicYear.repository");
const classRepo = require("../classes/class.repository");
const auditRepo = require("../audit/audit.repository");
const {
  validateId,
  validatePagination,
  validateCreateFeeStructure,
  validatePatchFeeStructure,
  validateCreateStudentFee,
  validatePatchStudentFee,
  validateCreatePayment,
} = require("./fee.validation");

async function getStudentIdForUser(userId) {
  const [rows] = await pool.execute(`SELECT id FROM students WHERE user_id = ?`, [userId]);
  return rows[0]?.id || null;
}

async function getLinkedStudentIdsForParent(parentUserId) {
  const [rows] = await pool.execute(
    `SELECT sp.student_id FROM student_parents sp
     JOIN parents_guardians pg ON pg.id = sp.parent_id
     WHERE pg.user_id = ?`,
    [parentUserId]
  );
  return rows.map((r) => r.student_id);
}

// ─── FEE STRUCTURES ───────────────────────────────────────────────────────────

async function getAllFeeStructures(query) {
  const { page, limit } = validatePagination(query);
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const fee_type = query.fee_type ? String(query.fee_type).trim() : null;

  const { feeStructures, total } = await repo.findAllStructures({
    page,
    limit,
    academic_year_id,
    class_id,
    fee_type,
  });

  const totalPages = Math.ceil(total / limit);
  return {
    feeStructures,
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

async function getFeeStructureById(idParam) {
  const id = validateId(idParam);
  const fs = await repo.findStructureById(id);
  if (!fs) {
    const err = new Error("Fee structure not found.");
    err.statusCode = 404;
    throw err;
  }
  return fs;
}

async function createFeeStructure(body, requester = null) {
  const data = validateCreateFeeStructure(body);

  const year = await ayRepo.findById(data.academic_year_id);
  if (!year) {
    const err = new Error("Referenced academic year does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const cls = await classRepo.findById(data.class_id);
  if (!cls) {
    const err = new Error("Referenced class does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await repo.findDuplicateStructure(data.academic_year_id, data.class_id, data.fee_type);
  if (duplicate) {
    const err = new Error("A fee structure for this academic year, class, and fee type already exists.");
    err.statusCode = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  const created = await repo.createStructure({ id, ...data });

  if (requester) {
    await auditRepo.createAuditLog({
      entity_type: "fee_structure",
      entity_id: id,
      action: "CREATE_FEE_STRUCTURE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.userName || "Administrator",
      reason: `Created fee structure '${data.fee_type}' for ${cls.class_name} (₹${data.amount})`,
      new_values: data,
    });
  }

  return created;
}

async function patchFeeStructure(idParam, body, requester = null) {
  const id = validateId(idParam);
  const existing = await repo.findStructureById(id);
  if (!existing) {
    const err = new Error("Fee structure not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatchFeeStructure(body);
  const updated = await repo.updateStructure(id, updates);

  if (requester) {
    await auditRepo.createAuditLog({
      entity_type: "fee_structure",
      entity_id: id,
      action: "UPDATE_FEE_STRUCTURE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.userName || "Administrator",
      reason: "Updated fee structure attributes",
      old_values: {
        fee_type: existing.fee_type,
        amount: existing.amount,
        due_date: existing.due_date,
      },
      new_values: updates,
    });
  }

  return updated;
}

async function removeFeeStructure(idParam, requester = null) {
  const id = validateId(idParam);
  const existing = await repo.findStructureById(id);
  if (!existing) {
    const err = new Error("Fee structure not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countStructureDependents(id);
  if (deps.studentFees > 0) {
    const err = new Error(`Cannot delete fee structure: referenced by ${deps.studentFees} student fee record(s).`);
    err.statusCode = 409;
    throw err;
  }

  await repo.removeStructure(id);

  if (requester) {
    await auditRepo.createAuditLog({
      entity_type: "fee_structure",
      entity_id: id,
      action: "DELETE_FEE_STRUCTURE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.userName || "Administrator",
      reason: `Deleted fee structure '${existing.fee_type}'`,
      old_values: existing,
    });
  }

  return { message: "Fee structure deleted successfully." };
}

// ─── STUDENT FEES ─────────────────────────────────────────────────────────────

async function getAllStudentFees(query, requester = null) {
  const { page, limit } = validatePagination(query);
  let student_id = query.student_id ? String(query.student_id).trim() : null;
  const fee_structure_id = query.fee_structure_id ? String(query.fee_structure_id).trim() : null;
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const status = query.status ? String(query.status).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

  // Student role: can ONLY see own fees
  if (requester && requester.role === "student") {
    const ownStudentId = await getStudentIdForUser(requester.userId);
    if (!ownStudentId) {
      return {
        studentFees: [],
        pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      };
    }
    student_id = ownStudentId;
  }

  // Parent role: can ONLY see linked students
  if (requester && requester.role === "parent") {
    const linkedIds = await getLinkedStudentIdsForParent(requester.userId);
    if (linkedIds.length === 0) {
      return {
        studentFees: [],
        pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      };
    }
    if (student_id && !linkedIds.includes(student_id)) {
      const err = new Error("Forbidden: student is not linked to your parent account.");
      err.statusCode = 403;
      throw err;
    }
    if (!student_id) {
      student_id = linkedIds[0];
    }
  }

  const { studentFees, total } = await repo.findAllStudentFees({
    page,
    limit,
    student_id,
    fee_structure_id,
    academic_year_id,
    class_id,
    section_id,
    status,
    search,
  });

  const totalPages = Math.ceil(total / limit);
  return {
    studentFees,
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

async function getStudentFeeById(idParam, requester = null) {
  const id = validateId(idParam);
  const sf = await repo.findStudentFeeById(id);
  if (!sf) {
    const err = new Error("Student fee record not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester && requester.role === "student") {
    const ownStudentId = await getStudentIdForUser(requester.userId);
    if (sf.student_id !== ownStudentId) {
      const err = new Error("Forbidden: you are not authorized to view this fee record.");
      err.statusCode = 403;
      throw err;
    }
  }

  if (requester && requester.role === "parent") {
    const linkedIds = await getLinkedStudentIdsForParent(requester.userId);
    if (!linkedIds.includes(sf.student_id)) {
      const err = new Error("Forbidden: fee record does not belong to a linked student.");
      err.statusCode = 403;
      throw err;
    }
  }

  return sf;
}

async function createStudentFee(body, requester = null) {
  const data = validateCreateStudentFee(body);

  const student = await studentRepo.findStudentById(data.student_id);
  if (!student) {
    const err = new Error("Referenced student does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const feeStructure = await repo.findStructureById(data.fee_structure_id);
  if (!feeStructure) {
    const err = new Error("Referenced fee structure does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const duplicate = await repo.findDuplicateStudentFee(data.student_id, data.fee_structure_id);
  if (duplicate) {
    const err = new Error("A fee record for this student and fee structure already exists.");
    err.statusCode = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  const created = await repo.createStudentFee({ id, ...data });

  if (requester) {
    await auditRepo.createAuditLog({
      entity_type: "student_fee",
      entity_id: id,
      action: "ASSIGN_STUDENT_FEE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.userName || "Administrator",
      reason: `Assigned '${feeStructure.fee_type}' to student ${student.first_name} ${student.last_name} (₹${data.amount_due})`,
      new_values: data,
    });
  }

  return created;
}

async function bulkAssignToClass(body, requester) {
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: only administrators can bulk assign fees.");
    err.statusCode = 403;
    throw err;
  }

  const { fee_structure_id, class_id, section_id, academic_year_id, amount_due } = body;
  const fsId = validateId(fee_structure_id, "fee_structure_id");
  const clsId = validateId(class_id, "class_id");
  const secId = section_id ? validateId(section_id, "section_id") : null;
  const ayId = academic_year_id ? validateId(academic_year_id, "academic_year_id") : null;

  const feeStructure = await repo.findStructureById(fsId);
  if (!feeStructure) {
    const err = new Error("Referenced fee structure does not exist.");
    err.statusCode = 400;
    throw err;
  }

  const finalAmount = amount_due !== undefined ? Number(amount_due) : Number(feeStructure.amount);
  if (isNaN(finalAmount) || finalAmount < 0) {
    const err = new Error("amount_due must be a non-negative number.");
    err.statusCode = 400;
    throw err;
  }

  const result = await repo.bulkAssignToClass({
    fee_structure_id: fsId,
    class_id: clsId,
    section_id: secId,
    academic_year_id: ayId || feeStructure.academic_year_id,
    amount_due: finalAmount,
  });

  await auditRepo.createAuditLog({
    entity_type: "student_fee",
    entity_id: fsId,
    action: "BULK_ASSIGN_FEES",
    user_id: requester.userId,
    user_role: requester.role,
    user_name: requester.userName || "Administrator",
    reason: `Assigned fee structure '${feeStructure.fee_type}' to class (assigned: ${result.assignedCount}, skipped: ${result.skippedCount}).`,
    new_values: {
      class_id: clsId,
      section_id: secId,
      fee_structure_id: fsId,
      amount_due: finalAmount,
      ...result,
    },
  });

  return result;
}

async function patchStudentFee(idParam, body, requester = null) {
  const id = validateId(idParam);
  const existing = await repo.findStudentFeeById(id);
  if (!existing) {
    const err = new Error("Student fee record not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatchStudentFee(body);

  // Recalculate balance if amount_due is updated
  if (updates.amount_due !== undefined) {
    const newBalance = Math.max(0, updates.amount_due - Number(existing.amount_paid));
    updates.balance = newBalance;
    if (!updates.status) {
      if (newBalance <= 0) updates.status = "paid";
      else if (Number(existing.amount_paid) > 0) updates.status = "partial";
      else updates.status = "unpaid";
    }
  }

  const updated = await repo.updateStudentFee(id, updates);

  if (requester) {
    await auditRepo.createAuditLog({
      entity_type: "student_fee",
      entity_id: id,
      action: "UPDATE_STUDENT_FEE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.userName || "Administrator",
      reason: body.reason || "Updated student fee amount / status",
      old_values: {
        amount_due: existing.amount_due,
        balance: existing.balance,
        status: existing.status,
      },
      new_values: updates,
    });
  }

  return updated;
}

async function removeStudentFee(idParam, requester = null) {
  const id = validateId(idParam);
  const existing = await repo.findStudentFeeById(id);
  if (!existing) {
    const err = new Error("Student fee record not found.");
    err.statusCode = 404;
    throw err;
  }

  const deps = await repo.countStudentFeeDependents(id);
  if (deps.payments > 0) {
    const err = new Error(`Cannot delete student fee: referenced by ${deps.payments} payment record(s).`);
    err.statusCode = 409;
    throw err;
  }

  await repo.removeStudentFee(id);

  if (requester) {
    await auditRepo.createAuditLog({
      entity_type: "student_fee",
      entity_id: id,
      action: "DELETE_STUDENT_FEE",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.userName || "Administrator",
      reason: `Deleted fee record for student ${existing.student_name}`,
      old_values: existing,
    });
  }

  return { message: "Student fee record deleted successfully." };
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

async function getAllPayments(query, requester = null) {
  const { page, limit } = validatePagination(query);
  const student_fee_id = query.student_fee_id ? String(query.student_fee_id).trim() : null;
  let student_id = query.student_id ? String(query.student_id).trim() : null;
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const payment_method = query.payment_method ? String(query.payment_method).trim() : null;
  const payment_status = query.payment_status ? String(query.payment_status).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

  if (requester && requester.role === "student") {
    const ownStudentId = await getStudentIdForUser(requester.userId);
    if (!ownStudentId) {
      return {
        payments: [],
        pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      };
    }
    student_id = ownStudentId;
  }

  if (requester && requester.role === "parent") {
    const linkedIds = await getLinkedStudentIdsForParent(requester.userId);
    if (linkedIds.length === 0) {
      return {
        payments: [],
        pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      };
    }
    if (student_id && !linkedIds.includes(student_id)) {
      const err = new Error("Forbidden: student is not linked to your parent account.");
      err.statusCode = 403;
      throw err;
    }
    if (!student_id) {
      student_id = linkedIds[0];
    }
  }

  const { payments, total } = await repo.findAllPayments({
    page,
    limit,
    student_fee_id,
    student_id,
    academic_year_id,
    payment_method,
    payment_status,
    search,
  });

  const totalPages = Math.ceil(total / limit);
  return {
    payments,
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

async function getPaymentById(idParam, requester = null) {
  const id = validateId(idParam);
  const payment = await repo.findPaymentById(id);
  if (!payment) {
    const err = new Error("Payment record not found.");
    err.statusCode = 404;
    throw err;
  }

  if (requester && requester.role === "student") {
    const ownStudentId = await getStudentIdForUser(requester.userId);
    if (payment.student_id !== ownStudentId) {
      const err = new Error("Forbidden: you are not authorized to view this payment receipt.");
      err.statusCode = 403;
      throw err;
    }
  }

  if (requester && requester.role === "parent") {
    const linkedIds = await getLinkedStudentIdsForParent(requester.userId);
    if (!linkedIds.includes(payment.student_id)) {
      const err = new Error("Forbidden: payment receipt does not belong to a linked student.");
      err.statusCode = 403;
      throw err;
    }
  }

  return payment;
}

async function recordPayment(body, requester = null) {
  const data = validateCreatePayment(body);

  const studentFee = await repo.findStudentFeeById(data.student_fee_id);
  if (!studentFee) {
    const err = new Error("Referenced student fee record does not exist.");
    err.statusCode = 400;
    throw err;
  }

  if (studentFee.status === "paid") {
    const err = new Error("This fee record is already fully paid.");
    err.statusCode = 409;
    throw err;
  }

  if (data.amount > Number(studentFee.balance)) {
    const err = new Error(`Payment amount (₹${data.amount}) cannot exceed outstanding balance (₹${studentFee.balance}).`);
    err.statusCode = 400;
    throw err;
  }

  const paymentId = crypto.randomUUID();

  // Auto-generate receipt number if not provided
  const receipt_number = data.receipt_number || `RCP-${Date.now()}-${paymentId.slice(0, 8).toUpperCase()}`;

  const recorded = await repo.recordPaymentTransaction({
    paymentId,
    ...data,
    payment_date: data.payment_date || null,
    receipt_number,
  });

  if (requester) {
    await auditRepo.createAuditLog({
      entity_type: "payment",
      entity_id: paymentId,
      action: "RECORD_PAYMENT",
      user_id: requester.userId,
      user_role: requester.role,
      user_name: requester.userName || "Administrator",
      reason: `Recorded fee payment of ₹${data.amount} (Receipt: ${receipt_number}) via ${data.payment_method}.`,
      new_values: {
        payment_id: paymentId,
        student_fee_id: data.student_fee_id,
        amount: data.amount,
        receipt_number,
        payment_method: data.payment_method,
      },
    });
  }

  return recorded;
}

async function getFinancialSummary(query = {}) {
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;

  return repo.getFinancialSummary({
    academic_year_id,
    class_id,
    section_id,
  });
}

module.exports = {
  getAllFeeStructures,
  getFeeStructureById,
  createFeeStructure,
  patchFeeStructure,
  removeFeeStructure,
  getAllStudentFees,
  getStudentFeeById,
  createStudentFee,
  bulkAssignToClass,
  patchStudentFee,
  removeStudentFee,
  getAllPayments,
  getPaymentById,
  recordPayment,
  getFinancialSummary,
};
