"use strict";

const { randomUUID } = require("crypto");
const bcrypt = require("bcryptjs");
const userRepository = require("./user.repository");
const {
  validatePaginationParams,
  validateRole,
  validateStatus,
  validateUpdateUserPayload,
  validateCreateUserPayload,
} = require("./user.validation");

/**
 * user.service.js
 *
 * Business logic layer for Users module.
 * Independent of Express req/res.
 */

async function getUsers(query) {
  const { page, limit } = validatePaginationParams(query.page, query.limit);
  const role = validateRole(query.role);
  const status = validateStatus(query.status);
  const search = query.search ? String(query.search) : undefined;

  const { users, total } = await userRepository.findAllUsers({
    page,
    limit,
    role,
    status,
    search,
  });

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

async function getUserById(id) {
  if (!id || typeof id !== "string") {
    const error = new Error("User ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await userRepository.findUserById(id.trim());
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return user;
}

async function getUserByEmail(email) {
  if (!email || typeof email !== "string" || email.trim() === "") {
    const error = new Error("Valid email is required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await userRepository.findUserByEmail(email.trim().toLowerCase());
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return user;
}

async function updateUser(id, body) {
  if (!id || typeof id !== "string") {
    const error = new Error("User ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const cleanId = id.trim();

  // Verify user exists first
  const existingUser = await userRepository.findUserById(cleanId);
  if (!existingUser) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Validate payload (rejects password, role, email changes)
  const updates = validateUpdateUserPayload(body);

  const updatedUser = await userRepository.updateUser(cleanId, updates);
  return updatedUser;
}

async function createUser(body) {
  const payload = validateCreateUserPayload(body);

  // Prevent duplicate email
  const existingUser = await userRepository.findUserByEmail(payload.email);
  if (existingUser) {
    const error = new Error("A user with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  // Hash password using bcryptjs
  const saltRounds = 10;
  const password_hash = await bcrypt.hash(payload.password, saltRounds);

  // Generate UUID
  const id = randomUUID();

  // Create user record in repository
  const newUser = await userRepository.createUser({
    id,
    name: payload.name,
    email: payload.email,
    password_hash,
    role: payload.role,
    phone: payload.phone,
    status: payload.status,
  });

  return newUser;
}

module.exports = {
  getUsers,
  getUserById,
  getUserByEmail,
  updateUser,
  createUser,
};
