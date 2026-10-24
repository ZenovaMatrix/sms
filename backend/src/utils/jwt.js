"use strict";

const jwt = require("jsonwebtoken");
const config = require("../config/env");

/**
 * jwt.js
 *
 * JWT utility functions for generating and verifying tokens.
 */

function generateToken(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Token payload must be an object.");
  }

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

function verifyToken(token) {
  if (!token || typeof token !== "string") {
    const error = new Error("Authentication token is required.");
    error.statusCode = 401;
    throw error;
  }

  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (err) {
    const error = new Error("Invalid or expired token.");
    error.statusCode = 401;
    throw error;
  }
}

module.exports = {
  generateToken,
  verifyToken,
};
