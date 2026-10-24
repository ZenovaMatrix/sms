"use strict";

const express = require("express");
const ctrl = require("./examination.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get("/", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getAllExamSubjects);
router.get("/:id", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getExamSubjectById);
router.post("/", authenticate, authorize("admin"), ctrl.createExamSubject);
router.patch("/:id", authenticate, authorize("admin"), ctrl.patchExamSubject);
router.delete("/:id", authenticate, authorize("admin"), ctrl.removeExamSubject);

module.exports = router;
