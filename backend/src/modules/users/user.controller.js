"use strict";

const userService = require("./user.service");

/**
 * user.controller.js
 *
 * HTTP controller for Users module.
 * Reads req.params, req.query, req.body and calls userService.
 * Formats standardized JSON HTTP responses.
 */

async function getAllUsers(req, res, next) {
  try {
    const result = await userService.getUsers(req.query);
    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function getUserByEmail(req, res, next) {
  try {
    const user = await userService.getUserByEmail(req.params.email);
    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/users
 * Creates a new user (admin-only).
 */
async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const updatedUser = await userService.updateUser(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/v1/users/:id
 * Intentionally disabled to preserve data integrity and foreign keys.
 */
async function deleteUser(req, res) {
  return res.status(501).json({
    success: false,
    message: "User deletion is disabled for data integrity",
    data: null,
  });
}

module.exports = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
};
