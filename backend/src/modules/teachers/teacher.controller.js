"use strict";

const teacherService = require("./teacher.service");

/**
 * teacher.controller.js
 *
 * HTTP controller for the Teachers module.
 */

async function getAllTeachers(req, res, next) {
  try {
    const result = await teacherService.getTeachers(req.query);
    return res.status(200).json({
      success: true,
      message: "Teachers fetched successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getTeacherById(req, res, next) {
  try {
    const teacher = await teacherService.getTeacherById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: "Teacher fetched successfully",
      data: teacher,
    });
  } catch (error) {
    return next(error);
  }
}

async function getTeacherByUserId(req, res, next) {
  try {
    const teacher = await teacherService.getTeacherByUserId(req.params.userId, req.user);
    return res.status(200).json({
      success: true,
      message: "Teacher fetched successfully",
      data: teacher,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateTeacher(req, res, next) {
  try {
    const updated = await teacherService.updateTeacher(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
}

async function createTeacher(req, res, next) {
  try {
    const teacher = await teacherService.createTeacher(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      data: teacher,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteTeacher(req, res, next) {
  try {
    const result = await teacherService.deleteTeacher(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAllTeachers,
  getTeacherById,
  getTeacherByUserId,
  updateTeacher,
  createTeacher,
  deleteTeacher,
};
