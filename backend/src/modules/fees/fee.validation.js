"use strict";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_FEE_TYPES = ["tuition", "transport", "library", "sports", "lab", "hostel", "exam", "other"];
const VALID_STATUSES = ["unpaid", "partial", "paid", "waived"];
const VALID_PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "online", "card", "other"];
const VALID_PAYMENT_STATUSES = ["success", "pending", "failed", "refunded"];

function validateId(id) {
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    const err = new Error("Invalid ID format: must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }
  return id.trim();
}

function validatePagination({ page, limit }) {
  let p = parseInt(page, 10);
  let l = parseInt(limit, 10);
  if (isNaN(p) || p < 1) p = 1;
  if (isNaN(l) || l < 1) l = 20;
  if (l > 100) l = 100;
  return { page: p, limit: l };
}

// ─── FEE STRUCTURES ───────────────────────────────────────────────────────────

function validateCreateFeeStructure(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["academic_year_id", "class_id", "fee_type", "amount", "due_date", "description"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["academic_year_id", "class_id", "fee_type", "amount"];
  for (const r of required) {
    if (body[r] === undefined || body[r] === null || body[r] === "") {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (!UUID_REGEX.test(String(body.academic_year_id).trim())) {
    const err = new Error("academic_year_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  if (!UUID_REGEX.test(String(body.class_id).trim())) {
    const err = new Error("class_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  const fee_type = String(body.fee_type).trim();
  if (!fee_type || fee_type.length > 100) {
    const err = new Error("fee_type must be a non-empty string up to 100 characters.");
    err.statusCode = 400;
    throw err;
  }

  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0) {
    const err = new Error("amount must be a positive number.");
    err.statusCode = 400;
    throw err;
  }

  let due_date = null;
  if (body.due_date) {
    if (!DATE_REGEX.test(String(body.due_date).trim())) {
      const err = new Error("due_date must be in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    due_date = String(body.due_date).trim();
  }

  let description = null;
  if (body.description !== undefined && body.description !== null) {
    description = String(body.description).trim();
    if (description.length > 500) {
      const err = new Error("description must not exceed 500 characters.");
      err.statusCode = 400;
      throw err;
    }
    if (!description) description = null;
  }

  return {
    academic_year_id: String(body.academic_year_id).trim(),
    class_id: String(body.class_id).trim(),
    fee_type,
    amount,
    due_date,
    description,
  };
}

function validatePatchFeeStructure(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["fee_type", "amount", "due_date", "description"];
  const updates = {};

  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown or immutable field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (Object.keys(body).length === 0) {
    const err = new Error("Request body must not be empty.");
    err.statusCode = 400;
    throw err;
  }

  if (body.fee_type !== undefined) {
    const fee_type = String(body.fee_type).trim();
    if (!fee_type || fee_type.length > 100) {
      const err = new Error("fee_type must be a non-empty string up to 100 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.fee_type = fee_type;
  }

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (isNaN(amount) || amount <= 0) {
      const err = new Error("amount must be a positive number.");
      err.statusCode = 400;
      throw err;
    }
    updates.amount = amount;
  }

  if (body.due_date !== undefined) {
    if (body.due_date === null) {
      updates.due_date = null;
    } else {
      if (!DATE_REGEX.test(String(body.due_date).trim())) {
        const err = new Error("due_date must be in YYYY-MM-DD format.");
        err.statusCode = 400;
        throw err;
      }
      updates.due_date = String(body.due_date).trim();
    }
  }

  if (body.description !== undefined) {
    if (body.description === null) {
      updates.description = null;
    } else {
      const desc = String(body.description).trim();
      if (desc.length > 500) {
        const err = new Error("description must not exceed 500 characters.");
        err.statusCode = 400;
        throw err;
      }
      updates.description = desc || null;
    }
  }

  return updates;
}

// ─── STUDENT FEES ─────────────────────────────────────────────────────────────

function validateCreateStudentFee(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["student_id", "fee_structure_id", "amount_due", "amount_paid", "status"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["student_id", "fee_structure_id", "amount_due"];
  for (const r of required) {
    if (body[r] === undefined || body[r] === null || body[r] === "") {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (!UUID_REGEX.test(String(body.student_id).trim())) {
    const err = new Error("student_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  if (!UUID_REGEX.test(String(body.fee_structure_id).trim())) {
    const err = new Error("fee_structure_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  const amount_due = Number(body.amount_due);
  if (isNaN(amount_due) || amount_due < 0) {
    const err = new Error("amount_due must be a non-negative number.");
    err.statusCode = 400;
    throw err;
  }

  let amount_paid = 0;
  if (body.amount_paid !== undefined && body.amount_paid !== null) {
    amount_paid = Number(body.amount_paid);
    if (isNaN(amount_paid) || amount_paid < 0) {
      const err = new Error("amount_paid must be a non-negative number.");
      err.statusCode = 400;
      throw err;
    }
  }

  const balance = Math.max(0, amount_due - amount_paid);
  let status = "unpaid";
  if (body.status) {
    const s = String(body.status).trim().toLowerCase();
    if (!VALID_STATUSES.includes(s)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(", ")}.`);
      err.statusCode = 400;
      throw err;
    }
    status = s;
  } else {
    if (balance <= 0) status = "paid";
    else if (amount_paid > 0) status = "partial";
  }

  return {
    student_id: String(body.student_id).trim(),
    fee_structure_id: String(body.fee_structure_id).trim(),
    amount_due,
    amount_paid,
    balance,
    status,
  };
}

function validatePatchStudentFee(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["amount_due", "status"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown or immutable field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (Object.keys(body).length === 0) {
    const err = new Error("Request body must not be empty.");
    err.statusCode = 400;
    throw err;
  }

  const updates = {};

  if (body.amount_due !== undefined) {
    const amount_due = Number(body.amount_due);
    if (isNaN(amount_due) || amount_due < 0) {
      const err = new Error("amount_due must be a non-negative number.");
      err.statusCode = 400;
      throw err;
    }
    updates.amount_due = amount_due;
  }

  if (body.status !== undefined) {
    const s = String(body.status).trim().toLowerCase();
    if (!VALID_STATUSES.includes(s)) {
      const err = new Error(`status must be one of: ${VALID_STATUSES.join(", ")}.`);
      err.statusCode = 400;
      throw err;
    }
    updates.status = s;
  }

  return updates;
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

function validateCreatePayment(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const allowed = ["student_fee_id", "amount", "payment_method", "transaction_id", "payment_status", "receipt_number", "payment_date"];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) {
      const err = new Error(`Unknown field: '${k}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  const required = ["student_fee_id", "amount", "payment_method"];
  for (const r of required) {
    if (body[r] === undefined || body[r] === null || body[r] === "") {
      const err = new Error(`Missing required field: '${r}'`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (!UUID_REGEX.test(String(body.student_fee_id).trim())) {
    const err = new Error("student_fee_id must be a valid UUID.");
    err.statusCode = 400;
    throw err;
  }

  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0) {
    const err = new Error("amount must be a positive number.");
    err.statusCode = 400;
    throw err;
  }

  const payment_method = String(body.payment_method).trim().toLowerCase();
  if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
    const err = new Error(`payment_method must be one of: ${VALID_PAYMENT_METHODS.join(", ")}.`);
    err.statusCode = 400;
    throw err;
  }

  let payment_status = "success";
  if (body.payment_status) {
    const ps = String(body.payment_status).trim().toLowerCase();
    if (!VALID_PAYMENT_STATUSES.includes(ps)) {
      const err = new Error(`payment_status must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}.`);
      err.statusCode = 400;
      throw err;
    }
    payment_status = ps;
  }

  let payment_date = null;
  if (body.payment_date) {
    if (!DATE_REGEX.test(String(body.payment_date).trim())) {
      const err = new Error("payment_date must be in YYYY-MM-DD format.");
      err.statusCode = 400;
      throw err;
    }
    payment_date = String(body.payment_date).trim();
  }

  let transaction_id = null;
  if (body.transaction_id) {
    transaction_id = String(body.transaction_id).trim();
    if (transaction_id.length > 100) {
      const err = new Error("transaction_id must not exceed 100 characters.");
      err.statusCode = 400;
      throw err;
    }
    if (!transaction_id) transaction_id = null;
  }

  let receipt_number = null;
  if (body.receipt_number) {
    receipt_number = String(body.receipt_number).trim();
    if (receipt_number.length > 50) {
      const err = new Error("receipt_number must not exceed 50 characters.");
      err.statusCode = 400;
      throw err;
    }
    if (!receipt_number) receipt_number = null;
  }

  return {
    student_fee_id: String(body.student_fee_id).trim(),
    amount,
    payment_method,
    transaction_id,
    payment_status,
    receipt_number,
    payment_date,
  };
}

module.exports = {
  validateId,
  validatePagination,
  validateCreateFeeStructure,
  validatePatchFeeStructure,
  validateCreateStudentFee,
  validatePatchStudentFee,
  validateCreatePayment,
};
