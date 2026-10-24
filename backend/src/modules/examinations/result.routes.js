"use strict";

const express = require("express");
const ctrl = require("./examination.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

const router = express.Router();

router.get("/", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getAllResults);
router.post("/bulk", authenticate, authorize("admin", "teacher"), ctrl.createBulkResults);
router.get("/:id", authenticate, authorize("admin", "teacher", "student", "parent"), ctrl.getResultById);
router.post("/", authenticate, authorize("admin", "teacher"), ctrl.createResult);
router.patch("/:id", authenticate, authorize("admin", "teacher"), ctrl.patchResult);
router.delete("/:id", authenticate, authorize("admin"), ctrl.removeResult);

module.exports = router;
