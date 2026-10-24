"use strict";

const service = require("./term.service");

async function getAll(req, res, next) {
  try {
    return res.status(200).json({ success: true, message: "Terms retrieved successfully.", data: await service.getAll(req.query) });
  } catch (e) { return next(e); }
}
async function getById(req, res, next) {
  try {
    return res.status(200).json({ success: true, message: "Term retrieved successfully.", data: await service.getById(req.params.id) });
  } catch (e) { return next(e); }
}
async function create(req, res, next) {
  try {
    return res.status(201).json({ success: true, message: "Term created successfully.", data: await service.create(req.body) });
  } catch (e) { return next(e); }
}
async function patch(req, res, next) {
  try {
    return res.status(200).json({ success: true, message: "Term updated successfully.", data: await service.patch(req.params.id, req.body) });
  } catch (e) { return next(e); }
}
async function remove(req, res, next) {
  try {
    return res.status(200).json({ success: true, message: "Term deleted successfully.", data: await service.remove(req.params.id) });
  } catch (e) { return next(e); }
}

module.exports = { getAll, getById, create, patch, remove };
