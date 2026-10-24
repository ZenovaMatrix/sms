"use strict";

const bcrypt = require("bcryptjs");
const authRepository = require("./auth.repository");
const { validateLoginPayload } = require("./auth.validation");
const { generateToken } = require("../../utils/jwt");

/**
 * auth.service.js
 *
 * Business logic layer for Authentication module.
 * Independent of Express req/res.
 */

async function login(payload) {
  // 1. Validate payload structure and types
  const { email, password } = validateLoginPayload(payload);

  // 2. Lookup user by email
  const user = await authRepository.findUserForAuth(email);
  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  // 3. Compare password with stored bcrypt hash
  let isPasswordValid = false;
  try {
    isPasswordValid = await bcrypt.compare(password, user.password_hash);
  } catch {
    // If hash is corrupt or unreadable, treat as invalid credentials
    isPasswordValid = false;
  }

  if (!isPasswordValid) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  // 4. Verify account status
  if (user.status === "inactive") {
    const error = new Error("User account is inactive");
    error.statusCode = 403;
    throw error;
  }

  if (user.status === "suspended") {
    const error = new Error("User account is suspended");
    error.statusCode = 403;
    throw error;
  }

  if (user.status !== "active") {
    const error = new Error("User account is not active");
    error.statusCode = 403;
    throw error;
  }

  // 5. Generate JWT with minimal safe identity claims
  const token = generateToken({
    userId: user.id,
    role: user.role,
  });

  // 6. Return token and safe user profile (never password_hash)
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      status: user.status,
    },
  };
}

module.exports = {
  login,
};
