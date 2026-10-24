"use strict";

const parentService = require("./parent.service");

/**
 * parent.controller.js
 *
 * HTTP controller for Parents and Student-Parent Relationships.
 */

async function getAllParents(req, res, next) {
  try {
    const result = await parentService.getParents(req.query);
    return res.status(200).json({
      success: true,
      message: "Parents fetched successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getParentById(req, res, next) {
  try {
    const parent = await parentService.getParentById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: "Parent fetched successfully",
      data: parent,
    });
  } catch (error) {
    return next(error);
  }
}

async function getParentByUserId(req, res, next) {
  try {
    const parent = await parentService.getParentByUserId(req.params.userId, req.user);
    return res.status(200).json({
      success: true,
      message: "Parent fetched successfully",
      data: parent,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateParent(req, res, next) {
  try {
    const updated = await parentService.updateParent(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      message: "Parent updated successfully",
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
}

async function createParent(req, res, next) {
  try {
    const parent = await parentService.createParent(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: "Parent created successfully",
      data: parent,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteParent(req, res, next) {
  try {
    const result = await parentService.deleteParent(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}

async function getStudentsByParentId(req, res, next) {
  try {
    const students = await parentService.getStudentsByParentId(req.params.parentId, req.user);
    return res.status(200).json({
      success: true,
      message: "Parent students fetched successfully",
      data: students,
    });
  } catch (error) {
    return next(error);
  }
}

async function getParentsByStudentId(req, res, next) {
  try {
    const parents = await parentService.getParentsByStudentId(req.params.studentId, req.user);
    return res.status(200).json({
      success: true,
      message: "Student parents fetched successfully",
      data: parents,
    });
  } catch (error) {
    return next(error);
  }
}

async function createRelationship(req, res, next) {
  try {
    const rel = await parentService.createRelationship(
      req.params.parentId,
      req.params.studentId,
      req.body
    );
    return res.status(201).json({
      success: true,
      message: "Student-parent relationship created successfully",
      data: rel,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteRelationship(req, res, next) {
  try {
    const result = await parentService.deleteRelationship(
      req.params.parentId,
      req.params.studentId,
      req.user
    );
    return res.status(200).json({
      success: true,
      message: result.message,
      data: null,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAllParents,
  getParentById,
  getParentByUserId,
  updateParent,
  createParent,
  deleteParent,
  getStudentsByParentId,
  getParentsByStudentId,
  createRelationship,
  deleteRelationship,
};
