"use strict";

const express = require("express");
const router = express.Router();
const controller = require("./correction.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

// Both teachers and admins can view requests (filtered by role)
router.get("/", authenticate, authorize("admin", "teacher"), controller.getRequests);
router.get("/:id", authenticate, authorize("admin", "teacher"), controller.getRequestById);

// Teachers (and admins) can create correction requests
router.post("/", authenticate, authorize("teacher", "admin"), controller.createRequest);

// Admins only can review (approve/reject) correction requests
router.patch("/:id/review", authenticate, authorize("admin"), controller.reviewRequest);

module.exports = router;
