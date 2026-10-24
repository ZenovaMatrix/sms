"use strict";

/**
 * user.validation.js
 *
 * Lightweight validation helper for User query and body parameters.
 */

const VALID_ROLES = ["admin", "teacher", "student", "parent", "librarian"];
const VALID_STATUSES = ["active", "inactive", "suspended"];

function validatePaginationParams(page, limit) {
  let parsedPage = parseInt(page, 10);
  let parsedLimit = parseInt(limit, 10);

  if (isNaN(parsedPage) || parsedPage < 1) {
    parsedPage = 1;
  }

  if (isNaN(parsedLimit) || parsedLimit < 1) {
    parsedLimit = 10;
  }

  // Enforce max limit of 100
  if (parsedLimit > 100) {
    parsedLimit = 100;
  }

  return { page: parsedPage, limit: parsedLimit };
}

function validateRole(role) {
  if (!role) return null;
  const normalized = role.trim().toLowerCase();
  if (!VALID_ROLES.includes(normalized)) {
    const error = new Error(`Invalid role filter. Allowed roles: ${VALID_ROLES.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function validateStatus(status) {
  if (!status) return null;
  const normalized = status.trim().toLowerCase();
  if (!VALID_STATUSES.includes(normalized)) {
    const error = new Error(`Invalid status filter. Allowed statuses: ${VALID_STATUSES.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function validateUpdateUserPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a valid JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    const err = new Error("At least one allowed field (name, phone, status) must be provided.");
    err.statusCode = 400;
    throw err;
  }

  const allowedFields = ["name", "phone", "status"];
  const updates = {};

  for (const key of keys) {
    if (key === "role") {
      const err = new Error("Updating role is not allowed through this endpoint.");
      err.statusCode = 400;
      throw err;
    }
    if (key === "password" || key === "password_hash") {
      const err = new Error("Updating password is not allowed in Phase 3A.");
      err.statusCode = 400;
      throw err;
    }
    if (key === "email") {
      const err = new Error("Updating email is not allowed through this endpoint.");
      err.statusCode = 400;
      throw err;
    }
    if (key === "id") {
      const err = new Error("Updating id is not allowed.");
      err.statusCode = 400;
      throw err;
    }
    if (!allowedFields.includes(key)) {
      const err = new Error(`Disallowed or unknown field '${key}'. Allowed fields: name, phone, status.`);
      err.statusCode = 400;
      throw err;
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      const err = new Error("Name must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    if (body.name.trim().length > 150) {
      const err = new Error("Name cannot exceed 150 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.name = body.name.trim();
  }

  if (body.phone !== undefined) {
    if (body.phone !== null && typeof body.phone !== "string") {
      const err = new Error("Phone must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    if (typeof body.phone === "string" && body.phone.trim().length > 20) {
      const err = new Error("Phone cannot exceed 20 characters.");
      err.statusCode = 400;
      throw err;
    }
    updates.phone = body.phone ? body.phone.trim() : null;
  }

  if (body.status !== undefined) {
    const validStatus = validateStatus(body.status);
    updates.status = validStatus;
  }

  if (Object.keys(updates).length === 0) {
    const err = new Error("At least one allowed field (name, phone, status) must be provided.");
    err.statusCode = 400;
    throw err;
  }

  return updates;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCreateUserPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a valid JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const { name, email, password, role, phone, status } = body;

  // Disallow forbidden system-managed fields
  for (const key of Object.keys(body)) {
    if (["id", "password_hash", "created_at", "updated_at"].includes(key)) {
      const err = new Error(`Field '${key}' is not allowed in user creation.`);
      err.statusCode = 400;
      throw err;
    }
  }

  // Name validation
  if (name === undefined || name === null || (typeof name === "string" && name.trim() === "")) {
    const err = new Error("Name is required.");
    err.statusCode = 400;
    throw err;
  }
  if (typeof name !== "string") {
    const err = new Error("Name must be a string.");
    err.statusCode = 400;
    throw err;
  }
  if (name.trim().length > 150) {
    const err = new Error("Name cannot exceed 150 characters.");
    err.statusCode = 400;
    throw err;
  }

  // Email validation
  if (email === undefined || email === null || (typeof email === "string" && email.trim() === "")) {
    const err = new Error("Email is required.");
    err.statusCode = 400;
    throw err;
  }
  if (typeof email !== "string") {
    const err = new Error("Email must be a string.");
    err.statusCode = 400;
    throw err;
  }
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail.length > 150) {
    const err = new Error("Email cannot exceed 150 characters.");
    err.statusCode = 400;
    throw err;
  }
  if (!EMAIL_REGEX.test(cleanEmail)) {
    const err = new Error("Invalid email format.");
    err.statusCode = 400;
    throw err;
  }

  // Password validation
  if (password === undefined || password === null || (typeof password === "string" && password === "")) {
    const err = new Error("Password is required.");
    err.statusCode = 400;
    throw err;
  }
  if (typeof password !== "string") {
    const err = new Error("Password must be a string.");
    err.statusCode = 400;
    throw err;
  }
  if (password.length < 6) {
    const err = new Error("Password must be at least 6 characters long.");
    err.statusCode = 400;
    throw err;
  }
  if (password.length > 128) {
    const err = new Error("Password cannot exceed 128 characters.");
    err.statusCode = 400;
    throw err;
  }

  // Role validation
  if (role === undefined || role === null || (typeof role === "string" && role.trim() === "")) {
    const err = new Error("Role is required.");
    err.statusCode = 400;
    throw err;
  }
  if (typeof role !== "string") {
    const err = new Error("Role must be a string.");
    err.statusCode = 400;
    throw err;
  }
  const cleanRole = role.trim().toLowerCase();
  if (!VALID_ROLES.includes(cleanRole)) {
    const err = new Error(`Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  // Phone validation (optional)
  let cleanPhone = null;
  if (phone !== undefined && phone !== null) {
    if (typeof phone !== "string") {
      const err = new Error("Phone must be a string or null.");
      err.statusCode = 400;
      throw err;
    }
    if (phone.trim().length > 20) {
      const err = new Error("Phone cannot exceed 20 characters.");
      err.statusCode = 400;
      throw err;
    }
    cleanPhone = phone.trim() === "" ? null : phone.trim();
  }

  // Status validation (optional, defaults to active)
  let cleanStatus = "active";
  if (status !== undefined && status !== null) {
    cleanStatus = validateStatus(status);
  }

  return {
    name: name.trim(),
    email: cleanEmail,
    password,
    role: cleanRole,
    phone: cleanPhone,
    status: cleanStatus,
  };
}

module.exports = {
  VALID_ROLES,
  VALID_STATUSES,
  validatePaginationParams,
  validateRole,
  validateStatus,
  validateUpdateUserPayload,
  validateCreateUserPayload,
};
