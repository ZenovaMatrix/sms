"use strict";

/**
 * academicYear.controller.js
 *
 * HTTP controller for the Academic Years module.
 */

const service = require("./academicYear.service");

async function getAll(req, res, next) {
  try {
    const result = await service.getAll(req.query);
    return res.status(200).json({ success: true, message: "Academic years retrieved successfully.", data: result });
  } catch (e) { return next(e); }
}

async function getById(req, res, next) {
  try {
    const ay = await service.getById(req.params.id);
    return res.status(200).json({ success: true, message: "Academic year retrieved successfully.", data: ay });
  } catch (e) { return next(e); }
}

async function create(req, res, next) {
  try {
    const ay = await service.create(req.body);
    return res.status(201).json({ success: true, message: "Academic year created successfully.", data: ay });
  } catch (e) { return next(e); }
}

async function patch(req, res, next) {
  try {
    const ay = await service.patch(req.params.id, req.body);
    return res.status(200).json({ success: true, message: "Academic year updated successfully.", data: ay });
  } catch (e) { return next(e); }
}

async function remove(req, res, next) {
  try {
    const result = await service.remove(req.params.id);
    return res.status(200).json({ success: true, message: "Academic year deleted successfully.", data: result });
  } catch (e) { return next(e); }
}

module.exports = { getAll, getById, create, patch, remove };
