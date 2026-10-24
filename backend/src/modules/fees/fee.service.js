"use strict";

const crypto = require("crypto");
const repo = require("./fee.repository");
const studentRepo = require("../students/student.repository");
const ayRepo = require("../academicYears/academicYear.repository");
const classRepo = require("../classes/class.repository");
const {
  validateId,
  validatePagination,
  validateCreateFeeStructure,
  validatePatchFeeStructure,
  validateCreateStudentFee,
  validatePatchStudentFee,
  validateCreatePayment,
} = require("./fee.validation");

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

async function createFeeStructure(body) {
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
  return repo.createStructure({ id, ...data });
}

async function patchFeeStructure(idParam, body) {
  const id = validateId(idParam);
  const existing = await repo.findStructureById(id);
  if (!existing) {
    const err = new Error("Fee structure not found.");
    err.statusCode = 404;
    throw err;
  }

  const updates = validatePatchFeeStructure(body);
  return repo.updateStructure(id, updates);
}

async function removeFeeStructure(idParam) {
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
  return { message: "Fee structure deleted successfully." };
}

// ─── STUDENT FEES ─────────────────────────────────────────────────────────────

async function getAllStudentFees(query) {
  const { page, limit } = validatePagination(query);
  const student_id = query.student_id ? String(query.student_id).trim() : null;
  const fee_structure_id = query.fee_structure_id ? String(query.fee_structure_id).trim() : null;
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const class_id = query.class_id ? String(query.class_id).trim() : null;
  const section_id = query.section_id ? String(query.section_id).trim() : null;
  const status = query.status ? String(query.status).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

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

async function getStudentFeeById(idParam) {
  const id = validateId(idParam);
  const sf = await repo.findStudentFeeById(id);
  if (!sf) {
    const err = new Error("Student fee record not found.");
    err.statusCode = 404;
    throw err;
  }
  return sf;
}

async function createStudentFee(body) {
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
  return repo.createStudentFee({ id, ...data });
}

async function patchStudentFee(idParam, body) {
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

  return repo.updateStudentFee(id, updates);
}

async function removeStudentFee(idParam) {
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
  return { message: "Student fee record deleted successfully." };
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

async function getAllPayments(query) {
  const { page, limit } = validatePagination(query);
  const student_fee_id = query.student_fee_id ? String(query.student_fee_id).trim() : null;
  const student_id = query.student_id ? String(query.student_id).trim() : null;
  const academic_year_id = query.academic_year_id ? String(query.academic_year_id).trim() : null;
  const payment_method = query.payment_method ? String(query.payment_method).trim() : null;
  const payment_status = query.payment_status ? String(query.payment_status).trim() : null;
  const search = query.search ? String(query.search).trim() : null;

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

async function getPaymentById(idParam) {
  const id = validateId(idParam);
  const payment = await repo.findPaymentById(id);
  if (!payment) {
    const err = new Error("Payment record not found.");
    err.statusCode = 404;
    throw err;
  }
  return payment;
}

async function recordPayment(body) {
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

  return repo.recordPaymentTransaction({
    paymentId,
    ...data,
    payment_date: data.payment_date || null,
    receipt_number,
  });
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
  patchStudentFee,
  removeStudentFee,
  getAllPayments,
  getPaymentById,
  recordPayment,
  getFinancialSummary,
};
