"use strict";

const express = require("express");
const router = express.Router();
const ctrl = require("./substitute.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

// Generate ranked AI/rule recommendations
router.get("/recommendations", authenticate, authorize("admin", "teacher"), ctrl.getRecommendations);

// List substitutions
router.get("/", authenticate, authorize("admin", "teacher"), ctrl.getAllSubstitutes);

// Assign a substitute (Admin only)
router.post("/assign", authenticate, authorize("admin"), ctrl.assignSubstitute);

// Update status (Admin only)
router.patch("/:id/status", authenticate, authorize("admin"), ctrl.updateStatus);

module.exports = router;

