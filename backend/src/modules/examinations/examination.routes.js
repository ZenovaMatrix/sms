"use strict";

const express = require("express");
const ctrl = require("./examination.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get("/", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getAllExams);
router.get("/:id", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getExamById);
router.post("/", authenticate, authorize("admin"), ctrl.createExam);
router.patch("/:id", authenticate, authorize("admin"), ctrl.patchExam);
router.delete("/:id", authenticate, authorize("admin"), ctrl.removeExam);

module.exports = router;
