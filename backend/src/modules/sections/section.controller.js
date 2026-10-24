"use strict";

const service = require("./section.service");

async function getAll(req, res, next) {
  try {
    const result = await service.getAll(req.query);
    res.status(200).json({
      success: true,
      message: "Sections retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const result = await service.getById(req.params.id);
    res.status(200).json({
      success: true,
      message: "Section retrieved successfully.",
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
      message: "Section created successfully.",
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
      message: "Section updated successfully.",
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
