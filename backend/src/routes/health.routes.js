"use strict";

const express = require("express");
const { getHealth } = require("../controllers/health.controller");

const router = express.Router();

/**
 * GET /
 * Mounted at /api/v1/health in app.js
 */
router.get("/", getHealth);

module.exports = router;
