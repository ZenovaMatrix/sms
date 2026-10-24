"use strict";

const service = require("./attendance.service");

// Sessions
async function getAllSessions(req, res, next) {
  try {
    const result = await service.getAllSessions(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Attendance sessions retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getSessionById(req, res, next) {
  try {
    const result = await service.getSessionById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Attendance session retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function createSession(req, res, next) {
  try {
    const result = await service.createSession(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Attendance session created successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function patchSession(req, res, next) {
  try {
    const result = await service.patchSession(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: "Attendance session updated successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function removeSession(req, res, next) {
  try {
    const result = await service.removeSession(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

// Attendance Records
async function getAllAttendance(req, res, next) {
  try {
    const result = await service.getAllAttendance(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Attendance records retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getAttendanceById(req, res, next) {
  try {
    const result = await service.getAttendanceById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Attendance record retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function createAttendance(req, res, next) {
  try {
    const result = await service.createAttendance(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Attendance recorded successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function patchAttendance(req, res, next) {
  try {
    const result = await service.patchAttendance(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: "Attendance record updated successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function saveBulk(req, res, next) {
  try {
    const result = await service.saveBulk(req.body, req.user);
    res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

async function getStudentSummary(req, res, next) {
  try {
    const result = await service.getStudentSummary(req.params.studentId, req.user);
    res.status(200).json({
      success: true,
      message: "Student attendance summary retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllSessions,
  getSessionById,
  createSession,
  patchSession,
  removeSession,
  getAllAttendance,
  getAttendanceById,
  createAttendance,
  patchAttendance,
  saveBulk,
  getStudentSummary,
};
