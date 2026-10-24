"use strict";

const pool = require("../../config/db");

const STRUCTURE_COLS = `
  fs.id,
  fs.academic_year_id,
  ay.year_name,
  fs.class_id,
  c.class_name,
  fs.fee_type,
  fs.amount,
  DATE_FORMAT(fs.due_date, '%Y-%m-%d') AS due_date,
  fs.description,
  fs.created_at
`;

const STUDENT_FEE_COLS = `
  sf.id,
  sf.student_id,
  s.student_id AS student_number,
  CONCAT(s.first_name, ' ', s.last_name) AS student_name,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  s.user_id AS student_user_id,
  sf.fee_structure_id,
  fs.fee_type,
  fs.academic_year_id,
  ay.year_name,
  fs.class_id,
  c.class_name,
  e.section_id,
  sec.section_name,
  sf.amount_due,
  sf.amount_paid,
  sf.balance,
  sf.status,
  DATE_FORMAT(fs.due_date, '%Y-%m-%d') AS due_date,
  sf.created_at,
  sf.updated_at
`;

const PAYMENT_COLS = `
  p.id,
  p.student_fee_id,
  sf.student_id,
  s.student_id AS student_number,
  CONCAT(s.first_name, ' ', s.last_name) AS student_name,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  s.user_id AS student_user_id,
  fs.fee_type,
  fs.academic_year_id,
  ay.year_name,
  fs.class_id,
  c.class_name,
  p.amount,
  p.payment_method,
  p.transaction_id,
  DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS payment_date,
  p.payment_status,
  p.receipt_number,
  p.created_at
`;

// ─── FEE STRUCTURES ───────────────────────────────────────────────────────────

async function findAllStructures({ page = 1, limit = 20, academic_year_id = null, class_id = null, fee_type = null }) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (academic_year_id) {
    where.push("fs.academic_year_id = ?");
    params.push(academic_year_id);
  }
  if (class_id) {
    where.push("fs.class_id = ?");
    params.push(class_id);
  }
  if (fee_type) {
    where.push("fs.fee_type LIKE ?");
    params.push(`%${fee_type}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM fee_structures fs
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${STRUCTURE_COLS} FROM fee_structures fs
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     ${whereSql}
     ORDER BY ay.start_date DESC, c.class_name ASC, fs.fee_type ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { feeStructures: rows, total: Number(total) };
}

async function findStructureById(id) {
  const [rows] = await pool.execute(
    `SELECT ${STRUCTURE_COLS} FROM fee_structures fs
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     WHERE fs.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findDuplicateStructure(academic_year_id, class_id, fee_type) {
  const [rows] = await pool.execute(
    `SELECT id FROM fee_structures
     WHERE academic_year_id = ? AND class_id = ? AND fee_type = ?`,
    [academic_year_id, class_id, fee_type]
  );
  return rows[0] || null;
}

async function createStructure({ id, academic_year_id, class_id, fee_type, amount, due_date, description }) {
  await pool.execute(
    `INSERT INTO fee_structures (id, academic_year_id, class_id, fee_type, amount, due_date, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, academic_year_id, class_id, fee_type, amount, due_date || null, description || null]
  );
  return findStructureById(id);
}

async function updateStructure(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    sets.push(`\`${k}\` = ?`);
    params.push(v);
  }
  if (!sets.length) return findStructureById(id);
  params.push(id);
  await pool.execute(`UPDATE fee_structures SET ${sets.join(", ")} WHERE id = ?`, params);
  return findStructureById(id);
}

async function removeStructure(id) {
  const [result] = await pool.execute(`DELETE FROM fee_structures WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countStructureDependents(id) {
  const [[{ cnt }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM student_fees WHERE fee_structure_id = ?`,
    [id]
  );
  return { studentFees: Number(cnt) };
}

// ─── STUDENT FEES ─────────────────────────────────────────────────────────────

async function findAllStudentFees({
  page = 1,
  limit = 20,
  student_id = null,
  fee_structure_id = null,
  academic_year_id = null,
  class_id = null,
  section_id = null,
  status = null,
  search = null,
}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (student_id) {
    where.push("sf.student_id = ?");
    params.push(student_id);
  }
  if (fee_structure_id) {
    where.push("sf.fee_structure_id = ?");
    params.push(fee_structure_id);
  }
  if (academic_year_id) {
    where.push("fs.academic_year_id = ?");
    params.push(academic_year_id);
  }
  if (class_id) {
    where.push("fs.class_id = ?");
    params.push(class_id);
  }
  if (section_id) {
    where.push("e.section_id = ?");
    params.push(section_id);
  }
  if (status) {
    if (status === "overdue") {
      where.push("sf.status != 'paid' AND fs.due_date IS NOT NULL AND fs.due_date < CURDATE()");
    } else {
      where.push("sf.status = ?");
      params.push(status);
    }
  }
  if (search) {
    where.push("(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_id LIKE ? OR CONCAT(s.first_name,' ',s.last_name) LIKE ?)");
    const pat = `%${search}%`;
    params.push(pat, pat, pat, pat);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM student_fees sf
     JOIN students s ON s.id = sf.student_id
     JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     LEFT JOIN enrollments e ON e.student_id = sf.student_id
       AND e.class_id = fs.class_id
       AND e.academic_year_id = fs.academic_year_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${STUDENT_FEE_COLS} FROM student_fees sf
     JOIN students s ON s.id = sf.student_id
     JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     LEFT JOIN enrollments e ON e.student_id = sf.student_id
       AND e.class_id = fs.class_id
       AND e.academic_year_id = fs.academic_year_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     ${whereSql}
     ORDER BY sf.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { studentFees: rows, total: Number(total) };
}

async function findStudentFeeById(id) {
  const [rows] = await pool.execute(
    `SELECT ${STUDENT_FEE_COLS} FROM student_fees sf
     JOIN students s ON s.id = sf.student_id
     JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     LEFT JOIN enrollments e ON e.student_id = sf.student_id
       AND e.class_id = fs.class_id
       AND e.academic_year_id = fs.academic_year_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     WHERE sf.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findDuplicateStudentFee(student_id, fee_structure_id) {
  const [rows] = await pool.execute(
    `SELECT id FROM student_fees WHERE student_id = ? AND fee_structure_id = ?`,
    [student_id, fee_structure_id]
  );
  return rows[0] || null;
}

async function createStudentFee({ id, student_id, fee_structure_id, amount_due, amount_paid, balance, status }) {
  await pool.execute(
    `INSERT INTO student_fees (id, student_id, fee_structure_id, amount_due, amount_paid, balance, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, student_id, fee_structure_id, amount_due, amount_paid || 0, balance, status || "unpaid"]
  );
  return findStudentFeeById(id);
}

async function updateStudentFee(id, updates) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    sets.push(`\`${k}\` = ?`);
    params.push(v);
  }
  if (!sets.length) return findStudentFeeById(id);
  params.push(id);
  await pool.execute(`UPDATE student_fees SET ${sets.join(", ")} WHERE id = ?`, params);
  return findStudentFeeById(id);
}

async function removeStudentFee(id) {
  const [result] = await pool.execute(`DELETE FROM student_fees WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

async function countStudentFeeDependents(id) {
  const [[{ cnt }]] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM payments WHERE student_fee_id = ?`,
    [id]
  );
  return { payments: Number(cnt) };
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

async function findAllPayments({
  page = 1,
  limit = 20,
  student_fee_id = null,
  student_id = null,
  academic_year_id = null,
  payment_method = null,
  payment_status = null,
  search = null,
}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (student_fee_id) {
    where.push("p.student_fee_id = ?");
    params.push(student_fee_id);
  }
  if (student_id) {
    where.push("sf.student_id = ?");
    params.push(student_id);
  }
  if (academic_year_id) {
    where.push("fs.academic_year_id = ?");
    params.push(academic_year_id);
  }
  if (payment_method) {
    where.push("p.payment_method = ?");
    params.push(payment_method);
  }
  if (payment_status) {
    where.push("p.payment_status = ?");
    params.push(payment_status);
  }
  if (search) {
    where.push("(s.first_name LIKE ? OR s.last_name LIKE ? OR p.receipt_number LIKE ? OR p.transaction_id LIKE ? OR CONCAT(s.first_name,' ',s.last_name) LIKE ?)");
    const pat = `%${search}%`;
    params.push(pat, pat, pat, pat, pat);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM payments p
     JOIN student_fees sf ON sf.id = p.student_fee_id
     JOIN students s ON s.id = sf.student_id
     JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT ${PAYMENT_COLS} FROM payments p
     JOIN student_fees sf ON sf.id = p.student_fee_id
     JOIN students s ON s.id = sf.student_id
     JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     ${whereSql}
     ORDER BY p.payment_date DESC, p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { payments: rows, total: Number(total) };
}

async function findPaymentById(id) {
  const [rows] = await pool.execute(
    `SELECT ${PAYMENT_COLS} FROM payments p
     JOIN student_fees sf ON sf.id = p.student_fee_id
     JOIN students s ON s.id = sf.student_id
     JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     JOIN academic_years ay ON ay.id = fs.academic_year_id
     JOIN classes c ON c.id = fs.class_id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

// ─── TRANSACTIONAL PAYMENT RECORDING ──────────────────────────────────────────

async function recordPaymentTransaction({
  paymentId,
  student_fee_id,
  amount,
  payment_method,
  transaction_id,
  payment_date,
  payment_status,
  receipt_number,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock student_fee record FOR UPDATE
    const [feeRows] = await conn.execute(
      `SELECT id, amount_due, amount_paid, balance, status FROM student_fees WHERE id = ? FOR UPDATE`,
      [student_fee_id]
    );

    if (feeRows.length === 0) {
      const err = new Error("Student fee record not found.");
      err.statusCode = 404;
      throw err;
    }

    const fee = feeRows[0];
    const newPaid = Number(fee.amount_paid) + Number(amount);
    const newBalance = Math.max(0, Number(fee.amount_due) - newPaid);

    let newStatus = "unpaid";
    if (newBalance <= 0) {
      newStatus = "paid";
    } else if (newPaid > 0) {
      newStatus = "partial";
    }

    const payDate = payment_date || new Date().toISOString().split("T")[0];

    // Insert payment
    await conn.execute(
      `INSERT INTO payments (id, student_fee_id, amount, payment_method, transaction_id, payment_date, payment_status, receipt_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, student_fee_id, amount, payment_method, transaction_id || null, payDate, payment_status || "success", receipt_number]
    );

    // Update student fee if payment status is 'success'
    if (!payment_status || payment_status === "success") {
      await conn.execute(
        `UPDATE student_fees SET amount_paid = ?, balance = ?, status = ? WHERE id = ?`,
        [newPaid, newBalance, newStatus, student_fee_id]
      );
    }

    await conn.commit();
    return findPaymentById(paymentId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── FINANCIAL SUMMARY ────────────────────────────────────────────────────────

async function getFinancialSummary({ academic_year_id = null, class_id = null, section_id = null }) {
  const where = [];
  const params = [];

  if (academic_year_id) {
    where.push("fs.academic_year_id = ?");
    params.push(academic_year_id);
  }
  if (class_id) {
    where.push("fs.class_id = ?");
    params.push(class_id);
  }
  if (section_id) {
    where.push("e.section_id = ?");
    params.push(section_id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[summary]] = await pool.execute(
    `SELECT
       COALESCE(SUM(sf.amount_due), 0) AS total_billed,
       COALESCE(SUM(sf.amount_paid), 0) AS total_collected,
       COALESCE(SUM(sf.balance), 0) AS total_outstanding,
       COUNT(CASE WHEN sf.status = 'paid' THEN 1 END) AS paid_count,
       COUNT(CASE WHEN sf.status = 'partial' THEN 1 END) AS partial_count,
       COUNT(CASE WHEN sf.status = 'unpaid' THEN 1 END) AS unpaid_count,
       COUNT(CASE WHEN sf.status != 'paid' AND fs.due_date IS NOT NULL AND fs.due_date < CURDATE() THEN 1 END) AS overdue_count,
       COALESCE(SUM(CASE WHEN sf.status != 'paid' AND fs.due_date IS NOT NULL AND fs.due_date < CURDATE() THEN sf.balance ELSE 0 END), 0) AS overdue_amount,
       COUNT(*) AS total_records
     FROM student_fees sf
     JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     LEFT JOIN enrollments e ON e.student_id = sf.student_id
       AND e.class_id = fs.class_id
       AND e.academic_year_id = fs.academic_year_id
     ${whereSql}`,
    params
  );

  return {
    totalBilled: Number(summary.total_billed),
    totalCollected: Number(summary.total_collected),
    totalOutstanding: Number(summary.total_outstanding),
    paidCount: Number(summary.paid_count),
    partialCount: Number(summary.partial_count),
    unpaidCount: Number(summary.unpaid_count),
    overdueCount: Number(summary.overdue_count),
    overdueAmount: Number(summary.overdue_amount),
    totalRecords: Number(summary.total_records),
  };
}

module.exports = {
  findAllStructures,
  findStructureById,
  findDuplicateStructure,
  createStructure,
  updateStructure,
  removeStructure,
  countStructureDependents,
  findAllStudentFees,
  findStudentFeeById,
  findDuplicateStudentFee,
  createStudentFee,
  updateStudentFee,
  removeStudentFee,
  countStudentFeeDependents,
  findAllPayments,
  findPaymentById,
  recordPaymentTransaction,
  getFinancialSummary,
};
