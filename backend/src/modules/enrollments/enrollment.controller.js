"use strict";

const service = require("./enrollment.service");

async function getAll(req, res, next) {
  try {
    const result = await service.getAll(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Enrollments retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const result = await service.getById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Enrollment retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await service.create(req.body);
    res.status(201).json({
      success: true,
      message: "Enrollment created successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function patch(req, res, next) {
  try {
    const result = await service.patch(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "Enrollment updated successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await service.remove(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  patch,
  remove,
};
