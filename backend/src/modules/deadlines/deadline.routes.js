"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./deadline.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

// Authenticated users (admin and teacher) can view policies and check window status
router.get("/", authenticate, authorize("admin", "teacher"), controller.getPolicies);
router.get("/attendance-window", authenticate, authorize("admin", "teacher"), controller.checkAttendanceWindow);
router.get("/grading-window", authenticate, authorize("admin", "teacher"), controller.checkGradingWindow);

// Admin only can update deadline policies
router.put("/:policy_type", authenticate, authorize("admin"), controller.updatePolicy);

module.exports = router;
