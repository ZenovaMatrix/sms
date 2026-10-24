"use strict";

const express = require("express");
const ctrl = require("./term.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

// GET: admin, teacher, student, parent
router.get("/", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getAll);
router.get("/:id", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getById);
// Mutate: admin only
router.post("/", authenticate, authorize("admin"), ctrl.create);
router.patch("/:id", authenticate, authorize("admin"), ctrl.patch);
router.delete("/:id", authenticate, authorize("admin"), ctrl.remove);

module.exports = router;
