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

function validateVerifyOtpPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Request body must be a valid JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const { tempToken, otp } = body;

  if (!tempToken || typeof tempToken !== "string" || tempToken.trim() === "") {
    const error = new Error("tempToken is required for OTP verification.");
    error.statusCode = 400;
    throw error;
  }

  if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
    const error = new Error("A valid 6-digit OTP code is required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    tempToken: tempToken.trim(),
    otp: otp.trim(),
  };
}

function validateResendOtpPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Request body must be a valid JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const { tempToken } = body;

  if (!tempToken || typeof tempToken !== "string" || tempToken.trim() === "") {
    const error = new Error("tempToken is required to resend OTP.");
    error.statusCode = 400;
    throw error;
  }

  return {
    tempToken: tempToken.trim(),
  };
}

function validateRegisterPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Request body must be a valid JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const { name, email, password } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    const error = new Error("Full Name is required.");
    error.statusCode = 400;
    throw error;
  }

  if (name.trim().length > 150) {
    const error = new Error("Name cannot exceed 150 characters.");
    error.statusCode = 400;
    throw error;
  }

  if (!email || typeof email !== "string" || email.trim() === "") {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleanEmail)) {
    const error = new Error("Invalid email format.");
    error.statusCode = 400;
    throw error;
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    const error = new Error("Password must be at least 6 characters long.");
    error.statusCode = 400;
    throw error;
  }

  if (password.length > 128) {
    const error = new Error("Password cannot exceed 128 characters.");
    error.statusCode = 400;
    throw error;
  }

  return {
    name: name.trim(),
    email: cleanEmail,
    password,
  };
}

module.exports = {
  validateLoginPayload,
  validateVerifyOtpPayload,
  validateResendOtpPayload,
  validateRegisterPayload,
};
