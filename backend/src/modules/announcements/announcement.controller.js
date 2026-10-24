"use strict";

/**
 * announcement.controller.js
 *
 * HTTP Controller for Announcements module.
 */

const service = require("./announcement.service");

async function getAll(req, res, next) {
  try {
    const data = await service.getAll(req.query, req.user);
    return res.status(200).json({
      success: true,
      message: "Announcements retrieved successfully",
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const data = await service.getById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Announcement retrieved successfully",
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await service.create(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function patch(req, res, next) {
  try {
    const data = await service.patch(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      data,
    });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.remove(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
      data: null,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  patch,
  remove,
};
