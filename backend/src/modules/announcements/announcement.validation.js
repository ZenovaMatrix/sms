"use strict";

/**
 * announcement.validation.js
 *
 * Validation rules for the Announcements module.
 */

const VALID_TARGET_TYPES = ["all", "students", "teachers", "parents", "class", "section"];
const VALID_STATUSES = ["draft", "published", "expired"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateId(id) {
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    const err = new Error("Invalid UUID format.");
    err.statusCode = 400;
    throw err;
  }
  return id.trim();
}

function validatePagination(query) {
  let page = parseInt(query?.page, 10);
  let limit = parseInt(query?.limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;

  return { page, limit };
}

function validateCreatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a valid JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const { title, message, target_type, class_id, section_id, publish_date, expiry_date, status } = body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    const err = new Error("Title is required.");
    err.statusCode = 400;
    throw err;
  }
  if (title.trim().length > 200) {
    const err = new Error("Title cannot exceed 200 characters.");
    err.statusCode = 400;
    throw err;
  }

  if (!message || typeof message !== "string" || message.trim() === "") {
    const err = new Error("Message is required.");
    err.statusCode = 400;
    throw err;
  }

  let cleanTarget = "all";
  if (target_type) {
    if (typeof target_type !== "string" || !VALID_TARGET_TYPES.includes(target_type.trim().toLowerCase())) {
      const err = new Error(`Invalid target_type. Allowed: ${VALID_TARGET_TYPES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    cleanTarget = target_type.trim().toLowerCase();
  }

  let cleanClassId = null;
  if (class_id) {
    cleanClassId = validateId(class_id);
  }

  let cleanSectionId = null;
  if (section_id) {
    cleanSectionId = validateId(section_id);
  }

  if (cleanTarget === "class" && !cleanClassId) {
    const err = new Error("class_id is required when target_type is 'class'.");
    err.statusCode = 400;
    throw err;
  }

  if (cleanTarget === "section" && (!cleanClassId || !cleanSectionId)) {
    const err = new Error("Both class_id and section_id are required when target_type is 'section'.");
    err.statusCode = 400;
    throw err;
  }

  let cleanStatus = "published";
  if (status) {
    if (typeof status !== "string" || !VALID_STATUSES.includes(status.trim().toLowerCase())) {
      const err = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    cleanStatus = status.trim().toLowerCase();
  }

  return {
    title: title.trim(),
    message: message.trim(),
    target_type: cleanTarget,
    class_id: cleanClassId,
    section_id: cleanSectionId,
    publish_date: publish_date ? new Date(publish_date) : new Date(),
    expiry_date: expiry_date ? new Date(expiry_date) : null,
    status: cleanStatus,
  };
}

function validatePatchPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Request body must be a valid JSON object.");
    err.statusCode = 400;
    throw err;
  }

  const updates = {};
  const { title, message, target_type, class_id, section_id, publish_date, expiry_date, status } = body;

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim() === "") {
      const err = new Error("Title must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    updates.title = title.trim();
  }

  if (message !== undefined) {
    if (typeof message !== "string" || message.trim() === "") {
      const err = new Error("Message must be a non-empty string.");
      err.statusCode = 400;
      throw err;
    }
    updates.message = message.trim();
  }

  if (target_type !== undefined) {
    const cleanTarget = String(target_type).trim().toLowerCase();
    if (!VALID_TARGET_TYPES.includes(cleanTarget)) {
      const err = new Error(`Invalid target_type. Allowed: ${VALID_TARGET_TYPES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    updates.target_type = cleanTarget;
  }

  if (class_id !== undefined) {
    updates.class_id = class_id ? validateId(class_id) : null;
  }

  if (section_id !== undefined) {
    updates.section_id = section_id ? validateId(section_id) : null;
  }

  if (publish_date !== undefined) {
    updates.publish_date = publish_date ? new Date(publish_date) : new Date();
  }

  if (expiry_date !== undefined) {
    updates.expiry_date = expiry_date ? new Date(expiry_date) : null;
  }

  if (status !== undefined) {
    const cleanStatus = String(status).trim().toLowerCase();
    if (!VALID_STATUSES.includes(cleanStatus)) {
      const err = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }
    updates.status = cleanStatus;
  }

  if (Object.keys(updates).length === 0) {
    const err = new Error("At least one valid field must be provided for update.");
    err.statusCode = 400;
    throw err;
  }

  return updates;
}

module.exports = {
  VALID_TARGET_TYPES,
  VALID_STATUSES,
  validateId,
  validatePagination,
  validateCreatePayload,
  validatePatchPayload,
};
