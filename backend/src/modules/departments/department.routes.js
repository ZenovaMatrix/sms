"use strict";

const express = require("express");
const ctrl = require("./department.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

// Teachers can view; students/parents cannot access department admin data
router.get("/", authenticate, authorize("admin", "teacher"), ctrl.getAll);
router.get("/:id", authenticate, authorize("admin", "teacher"), ctrl.getById);
router.post("/", authenticate, authorize("admin"), ctrl.create);
router.patch("/:id", authenticate, authorize("admin"), ctrl.patch);
router.delete("/:id", authenticate, authorize("admin"), ctrl.remove);

module.exports = router;
