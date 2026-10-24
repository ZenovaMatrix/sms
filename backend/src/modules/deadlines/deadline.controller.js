"use strict";

const service = require("./deadline.service");

async function getPolicies(req, res, next) {
  try {
    const data = await service.getPolicies();
    res.status(200).json({
      success: true,
      message: "Policies retrieved successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function updatePolicy(req, res, next) {
  try {
    const { policy_type } = req.params;
    const data = await service.updatePolicy(policy_type, req.body, req.user);
    res.status(200).json({
      success: true,
      message: "Policy updated successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function checkAttendanceWindow(req, res, next) {
  try {
    const { date } = req.query;
    const sessionDate = date || new Date().toISOString().split("T")[0];
    const data = await service.checkAttendanceWindow(sessionDate);
    res.status(200).json({
      success: true,
      message: "Attendance window status checked.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

async function checkGradingWindow(req, res, next) {
  try {
    const { exam_end_date } = req.query;
    const data = await service.checkGradingWindow(exam_end_date);
    res.status(200).json({
      success: true,
      message: "Grading window status checked.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPolicies,
  updatePolicy,
  checkAttendanceWindow,
  checkGradingWindow,
};
