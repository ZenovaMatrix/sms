"use strict";

const express = require("express");
const ctrl = require("./fee.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();
// ─── FINANCIAL SUMMARY ────────────────────────────────────────────────────────
router.get(
  "/summary",
  authenticate,
  authorize("admin", "teacher"),
  ctrl.getFinancialSummary
);

// ─── FEE STRUCTURES ───────────────────────────────────────────────────────────

router.get(
  "/structures",
  authenticate,
  authorize("admin", "teacher"),
  ctrl.getAllFeeStructures
);

router.get(
  "/structures/:id",
  authenticate,
  authorize("admin", "teacher"),
  ctrl.getFeeStructureById
);

router.post(
  "/structures",
  authenticate,
  authorize("admin"),
  ctrl.createFeeStructure
);

router.patch(
  "/structures/:id",
  authenticate,
  authorize("admin"),
  ctrl.patchFeeStructure
);

router.delete(
  "/structures/:id",
  authenticate,
  authorize("admin"),
  ctrl.removeFeeStructure
);

// ─── STUDENT FEES ─────────────────────────────────────────────────────────────

router.get(
  "/student-fees",
  authenticate,
  authorize("admin", "teacher"),
  ctrl.getAllStudentFees
);

router.get(
  "/student-fees/:id",
  authenticate,
  authorize("admin", "teacher"),
  ctrl.getStudentFeeById
);

router.post(
  "/student-fees",
  authenticate,
  authorize("admin"),
  ctrl.createStudentFee
);

router.patch(
  "/student-fees/:id",
  authenticate,
  authorize("admin"),
  ctrl.patchStudentFee
);

router.delete(
  "/student-fees/:id",
  authenticate,
  authorize("admin"),
  ctrl.removeStudentFee
);

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

router.get(
  "/payments",
  authenticate,
  authorize("admin", "teacher"),
  ctrl.getAllPayments
);

router.get(
  "/payments/:id",
  authenticate,
  authorize("admin", "teacher"),
  ctrl.getPaymentById
);

router.post(
  "/payments",
  authenticate,
  authorize("admin"),
  ctrl.recordPayment
);

module.exports = router;
