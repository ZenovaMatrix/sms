"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./audit.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

// Admin only can inspect audit logs
router.get("/", authenticate, authorize("admin"), controller.getLogs);

module.exports = router;
