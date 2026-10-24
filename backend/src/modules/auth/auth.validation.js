"use strict";

/**
 * auth.validation.js
 *
 * Lightweight validation helper for Authentication endpoints.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLoginPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Request body must be a valid JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const { email, password } = body;

  if (email === undefined || email === null || (typeof email === "string" && email.trim() === "")) {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof email !== "string") {
    const error = new Error("Email must be a string.");
    error.statusCode = 400;
    throw error;
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(cleanEmail)) {
    const error = new Error("Invalid email format.");
    error.statusCode = 400;
    throw error;
  }

  if (password === undefined || password === null || (typeof password === "string" && password === "")) {
    const error = new Error("Password is required.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof password !== "string") {
    const error = new Error("Password must be a string.");
    error.statusCode = 400;
    throw error;
  }

  return {
    email: cleanEmail,
    password,
  };
}

module.exports = {
  validateLoginPayload,
};
