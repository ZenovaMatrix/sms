"use strict";

const service = require("./substitute.service");

async function getRecommendations(req, res, next) {
  try {
    const data = await service.getRecommendations(req.query);
    return res.status(200).json({
      success: true,
      message: "Substitute recommendations generated successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function assignSubstitute(req, res, next) {
  try {
    const data = await service.assignSubstitute(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: "Substitute teacher assigned and notified successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function getAllSubstitutes(req, res, next) {
  try {
    const data = await service.getAllSubstitutes(req.query, req.user);
    return res.status(200).json({
      success: true,
      message: "Substitute assignments retrieved successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const data = await service.updateStatus(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: "Substitute assignment status updated successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRecommendations,
  assignSubstitute,
  getAllSubstitutes,
  updateStatus,
};

