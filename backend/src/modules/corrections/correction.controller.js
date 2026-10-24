"use strict";

const service = require("./correction.service");

async function createRequest(req, res, next) {
  try {
    const data = await service.createRequest(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Correction request submitted successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function getRequests(req, res, next) {
  try {
    const data = await service.getRequests(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Correction requests retrieved successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function getRequestById(req, res, next) {
  try {
    const data = await service.getRequestById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Correction request retrieved successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function reviewRequest(req, res, next) {
  try {
    const data = await service.reviewRequest(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: `Correction request has been ${data.status}.`,
      data,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  reviewRequest,
};
