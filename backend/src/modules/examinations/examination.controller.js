"use strict";

const service = require("./examination.service");

// Examinations
async function getAllExams(req, res, next) {
  try {
    const result = await service.getAllExams(req.query);
    res.status(200).json({
      success: true,
      message: "Examinations retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getExamById(req, res, next) {
  try {
    const result = await service.getExamById(req.params.id);
    res.status(200).json({
      success: true,
      message: "Examination retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function createExam(req, res, next) {
  try {
    const result = await service.createExam(req.body);
    res.status(201).json({
      success: true,
      message: "Examination created successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function patchExam(req, res, next) {
  try {
    const result = await service.patchExam(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "Examination updated successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function removeExam(req, res, next) {
  try {
    const result = await service.removeExam(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

// Exam Subjects
async function getAllExamSubjects(req, res, next) {
  try {
    const result = await service.getAllExamSubjects(req.query);
    res.status(200).json({
      success: true,
      message: "Exam subjects retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getExamSubjectById(req, res, next) {
  try {
    const result = await service.getExamSubjectById(req.params.id);
    res.status(200).json({
      success: true,
      message: "Exam subject retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function createExamSubject(req, res, next) {
  try {
    const result = await service.createExamSubject(req.body);
    res.status(201).json({
      success: true,
      message: "Exam subject created successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function patchExamSubject(req, res, next) {
  try {
    const result = await service.patchExamSubject(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "Exam subject updated successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function removeExamSubject(req, res, next) {
  try {
    const result = await service.removeExamSubject(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

// Results
async function getAllResults(req, res, next) {
  try {
    const result = await service.getAllResults(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Results retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getResultById(req, res, next) {
  try {
    const result = await service.getResultById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Result retrieved successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function createResult(req, res, next) {
  try {
    const result = await service.createResult(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Result recorded successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function patchResult(req, res, next) {
  try {
    const result = await service.patchResult(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: "Result updated successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function createBulkResults(req, res, next) {
  try {
    const result = await service.createBulkResults(req.body, req.user);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function removeResult(req, res, next) {
  try {
    const result = await service.removeResult(req.params.id);
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
  getAllExams,
  getExamById,
  createExam,
  patchExam,
  removeExam,
  getAllExamSubjects,
  getExamSubjectById,
  createExamSubject,
  patchExamSubject,
  removeExamSubject,
  getAllResults,
  getResultById,
  createResult,
  patchResult,
  createBulkResults,
  removeResult,
};
