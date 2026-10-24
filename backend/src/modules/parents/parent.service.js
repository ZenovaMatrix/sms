"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const parentRepository = require("./parent.repository");
const studentRepository = require("../students/student.repository");
const {
  validateParentId,
  validateUserId,
  validateStudentId,
  validateParentPaginationAndSearch,
  validatePatchParentPayload,
  validateCreateRelationshipPayload,
} = require("./parent.validation");

/**
 * parent.service.js
 *
 * Business logic layer for Parents and Student-Parent Relationships.
 */

// ─── GET ALL PARENTS ─────────────────────────────────────────────────────────

async function getParents(query) {
  const { page, limit, search, class_id, section_id, student_id } = validateParentPaginationAndSearch(query);

  const { parents, total } = await parentRepository.findAllParents({
    page,
    limit,
    search,
    class_id,
    section_id,
    student_id,
  });

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

  return {
    parents,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

// ─── GET PARENT BY ID ────────────────────────────────────────────────────────

async function getParentById(id, requester) {
  const cleanId = validateParentId(id);

  const parent = await parentRepository.findParentById(cleanId);
  if (!parent) {
    const err = new Error("Parent not found");
    err.statusCode = 404;
    throw err;
  }

  // Parent role ownership check: may only access own record
  if (requester.role === "parent") {
    if (parent.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only access your own parent record.");
      err.statusCode = 403;
      throw err;
    }
  }

  return parent;
}

// ─── GET PARENT BY USER ID ────────────────────────────────────────────────────

async function getParentByUserId(userId, requester) {
  const cleanUserId = validateUserId(userId);

  // Parent role ownership check: may only access own userId
  if (requester.role === "parent") {
    if (cleanUserId !== requester.userId) {
      const err = new Error("Forbidden: you may only access your own parent record.");
      err.statusCode = 403;
      throw err;
    }
  }

  const parent = await parentRepository.findParentByUserId(cleanUserId);
  if (!parent) {
    const err = new Error("Parent not found");
    err.statusCode = 404;
    throw err;
  }

  return parent;
}

// ─── PATCH PARENT ────────────────────────────────────────────────────────────

async function updateParent(id, body, requester) {
  const cleanId = validateParentId(id);
  const updates = validatePatchParentPayload(body);

  const existing = await parentRepository.findParentById(cleanId);
  if (!existing) {
    const err = new Error("Parent not found");
    err.statusCode = 404;
    throw err;
  }

  // Parent role ownership check
  if (requester.role === "parent") {
    if (existing.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only modify your own parent record.");
      err.statusCode = 403;
      throw err;
    }
  }

  if (updates.status) {
    if (requester.role !== "admin") {
      const err = new Error("Forbidden: only administrators can change parent account status.");
      err.statusCode = 403;
      throw err;
    }
    await parentRepository.setUserStatus(existing.user_id, updates.status);
    delete updates.status;
  }

  let updated = existing;
  if (Object.keys(updates).length > 0) {
    updated = await parentRepository.updateParent(cleanId, updates);
  }
  return updated;
}

// ─── POST PARENT ──────────────────────────────────────────────────────────────

async function createParent(body, requester) {
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: Only administrators may register parents.");
    err.statusCode = 403;
    throw err;
  }

  const fullName = body.full_name || body.fullName || body.name;
  const email = (body.email || "").trim().toLowerCase();
  const phone = body.phone || null;
  const occupation = body.occupation || null;
  const address = body.address || null;

  if (!fullName || !email) {
    const err = new Error("Full name and valid email address are required.");
    err.statusCode = 400;
    throw err;
  }

  const userId = crypto.randomUUID();
  const parentId = crypto.randomUUID();
  const rawPassword = body.password || "Password@123";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  try {
    const createdParent = await parentRepository.createParent({
      user: {
        id: userId,
        name: fullName,
        email,
        passwordHash,
        phone,
      },
      parent: {
        id: parentId,
        fullName,
        email,
        phone,
        occupation,
        address,
      },
    });

    return createdParent;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      const err = new Error("A user account with this email address already exists.");
      err.statusCode = 409;
      throw err;
    }
    throw error;
  }
}

async function deleteParent(id, requester) {
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: Only administrators may deactivate parents.");
    err.statusCode = 403;
    throw err;
  }
  const cleanId = validateParentId(id);
  const existing = await parentRepository.findParentById(cleanId);
  if (!existing) {
    const err = new Error("Parent not found");
    err.statusCode = 404;
    throw err;
  }

  // Safe deactivation: deactivate the linked user account while preserving relational and financial history
  await parentRepository.setUserStatus(existing.user_id, "inactive");
  return { message: "Parent account deactivated successfully, preserving historical and relational records." };
}

// ─── GET STUDENTS BY PARENT ID ────────────────────────────────────────────────

async function getStudentsByParentId(parentId, requester) {
  const cleanParentId = validateParentId(parentId);

  const parent = await parentRepository.findParentById(cleanParentId);
  if (!parent) {
    const err = new Error("Parent not found");
    err.statusCode = 404;
    throw err;
  }

  // Ownership verification for parent
  if (requester.role === "parent") {
    if (parent.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only view your own linked students.");
      err.statusCode = 403;
      throw err;
    }
  }

  const students = await parentRepository.findStudentsByParentId(cleanParentId);
  return students;
}

// ─── GET PARENTS BY STUDENT ID ────────────────────────────────────────────────

async function getParentsByStudentId(studentId, requester) {
  const cleanStudentId = validateStudentId(studentId);

  const student = await studentRepository.findStudentById(cleanStudentId);
  if (!student) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }

  // Ownership checks
  if (requester.role === "student") {
    // Student can only see their own parents
    if (student.user_id !== requester.userId) {
      const err = new Error("Forbidden: you may only view your own parent relationships.");
      err.statusCode = 403;
      throw err;
    }
  } else if (requester.role === "parent") {
    // Parent can only view if this student is linked to them
    const parentRecord = await parentRepository.findParentByUserId(requester.userId);
    if (!parentRecord) {
      const err = new Error("Forbidden: parent profile not found.");
      err.statusCode = 403;
      throw err;
    }
    const rel = await parentRepository.findRelationship(parentRecord.id, cleanStudentId);
    if (!rel) {
      const err = new Error("Forbidden: you are not linked to this student.");
      err.statusCode = 403;
      throw err;
    }
  }

  const parents = await parentRepository.findParentsByStudentId(cleanStudentId);
  return parents;
}

// ─── CREATE RELATIONSHIP (ADMIN ONLY) ─────────────────────────────────────────

async function createRelationship(parentId, studentId, body) {
  const cleanParentId = validateParentId(parentId);
  const cleanStudentId = validateStudentId(studentId);
  const { relationship, isPrimaryContact, isEmergencyContact } =
    validateCreateRelationshipPayload(body);

  const parent = await parentRepository.findParentById(cleanParentId);
  if (!parent) {
    const err = new Error("Parent not found");
    err.statusCode = 404;
    throw err;
  }

  const student = await studentRepository.findStudentById(cleanStudentId);
  if (!student) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }

  const existing = await parentRepository.findRelationship(cleanParentId, cleanStudentId);
  if (existing) {
    const err = new Error("Relationship already exists between this student and parent");
    err.statusCode = 409;
    throw err;
  }

  const id = crypto.randomUUID();
  const created = await parentRepository.createRelationship({
    id,
    parentId: cleanParentId,
    studentId: cleanStudentId,
    relationship,
    isPrimaryContact,
    isEmergencyContact,
  });

  return created;
}

async function deleteRelationship(parentId, studentId, requester) {
  if (requester.role !== "admin") {
    const err = new Error("Forbidden: Only administrators may unlink students from parents.");
    err.statusCode = 403;
    throw err;
  }
  const cleanParentId = validateParentId(parentId);
  const cleanStudentId = validateStudentId(studentId);

  const existing = await parentRepository.findRelationship(cleanParentId, cleanStudentId);
  if (!existing) {
    const err = new Error("Relationship not found between this student and parent.");
    err.statusCode = 404;
    throw err;
  }

  await parentRepository.deleteRelationship(cleanParentId, cleanStudentId);
  return { message: "Student unlinked from parent successfully." };
}

module.exports = {
  getParents,
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
