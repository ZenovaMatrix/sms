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

  const { email, password, selectedRole } = body;

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

  let cleanRole = null;
  if (selectedRole !== undefined && selectedRole !== null && selectedRole !== "") {
    if (typeof selectedRole !== "string") {
      const error = new Error("selectedRole must be a string.");
      error.statusCode = 400;
      throw error;
    }
    cleanRole = selectedRole.trim().toLowerCase();
    const validRoles = ["admin", "teacher", "faculty", "student", "parent", "librarian"];
    if (!validRoles.includes(cleanRole)) {
      const error = new Error(`Invalid role selection. Valid roles are: Admin, Faculty, Student, Parent, Librarian.`);
      error.statusCode = 400;
      throw error;
    }
  }

  return {
    email: cleanEmail,
    password,
    selectedRole: cleanRole,
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

  const { name, email, password, role } = body;

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

  let requestedRole = "student";
  if (role !== undefined && role !== null && role !== "") {
    if (typeof role !== "string") {
      const error = new Error("Role must be a string.");
      error.statusCode = 400;
      throw error;
    }
    const cleanRequestedRole = role.trim().toLowerCase();
    if (["admin", "teacher", "faculty", "librarian"].includes(cleanRequestedRole)) {
      const error = new Error("Faculty, Librarian, and Administrator accounts must be created by institution management.");
      error.statusCode = 403;
      throw error;
    }
    if (!["student", "parent"].includes(cleanRequestedRole)) {
      const error = new Error("Self-registration is only allowed for Student and Parent accounts.");
      error.statusCode = 400;
      throw error;
    }
    requestedRole = cleanRequestedRole;
  }

  return {
    name: name.trim(),
    email: cleanEmail,
    password,
    role: requestedRole,
  };
}

module.exports = {
  validateLoginPayload,
  validateVerifyOtpPayload,
  validateResendOtpPayload,
  validateRegisterPayload,
};
