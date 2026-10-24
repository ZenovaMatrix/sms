"use strict";

const service = require("./fee.service");

// ─── FEE STRUCTURES ───────────────────────────────────────────────────────────

async function getAllFeeStructures(req, res, next) {
  try {
    const result = await service.getAllFeeStructures(req.query);
    res.status(200).json({ success: true, message: "Fee structures retrieved successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function getFeeStructureById(req, res, next) {
  try {
    const result = await service.getFeeStructureById(req.params.id);
    res.status(200).json({ success: true, message: "Fee structure retrieved successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function createFeeStructure(req, res, next) {
  try {
    const result = await service.createFeeStructure(req.body);
    res.status(201).json({ success: true, message: "Fee structure created successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function patchFeeStructure(req, res, next) {
  try {
    const result = await service.patchFeeStructure(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Fee structure updated successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function removeFeeStructure(req, res, next) {
  try {
    const result = await service.removeFeeStructure(req.params.id);
    res.status(200).json({ success: true, message: result.message, data: null });
  } catch (err) {
    next(err);
  }
}

// ─── STUDENT FEES ─────────────────────────────────────────────────────────────

async function getAllStudentFees(req, res, next) {
  try {
    const result = await service.getAllStudentFees(req.query);
    res.status(200).json({ success: true, message: "Student fees retrieved successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function getStudentFeeById(req, res, next) {
  try {
    const result = await service.getStudentFeeById(req.params.id);
    res.status(200).json({ success: true, message: "Student fee retrieved successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function createStudentFee(req, res, next) {
  try {
    const result = await service.createStudentFee(req.body);
    res.status(201).json({ success: true, message: "Student fee record created successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function patchStudentFee(req, res, next) {
  try {
    const result = await service.patchStudentFee(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Student fee record updated successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function removeStudentFee(req, res, next) {
  try {
    const result = await service.removeStudentFee(req.params.id);
    res.status(200).json({ success: true, message: result.message, data: null });
  } catch (err) {
    next(err);
  }
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

async function getAllPayments(req, res, next) {
  try {
    const result = await service.getAllPayments(req.query);
    res.status(200).json({ success: true, message: "Payments retrieved successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function getPaymentById(req, res, next) {
  try {
    const result = await service.getPaymentById(req.params.id);
    res.status(200).json({ success: true, message: "Payment retrieved successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function recordPayment(req, res, next) {
  try {
    const result = await service.recordPayment(req.body);
    res.status(201).json({ success: true, message: "Payment recorded successfully.", data: result });
  } catch (err) {
    next(err);
  }
}

async function getFinancialSummary(req, res, next) {
  try {
    const result = await service.getFinancialSummary(req.query);
    res.status(200).json({ success: true, message: "Financial summary retrieved successfully.", data: result });
  } catch (err) {
    next(err);
  }
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
