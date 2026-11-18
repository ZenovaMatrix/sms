"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const authRepository = require("./auth.repository");
const userRepository = require("../users/user.repository");
const {
  validateLoginPayload,
  validateVerifyOtpPayload,
  validateResendOtpPayload,
  validateRegisterPayload,
} = require("./auth.validation");
const { generateToken, verifyToken } = require("../../utils/jwt");
const { sendOtpEmail } = require("../../utils/email.service");

/**
 * auth.service.js
 *
 * Business logic layer for Authentication module.
 * Independent of Express req/res.
 */

// Helper to generate a cryptographically strong 6-digit numeric OTP
function generateSecureOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

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

  // 5. ADMIN 2FA OTP REQUIREMENT
  // If the user has role 'admin', issue a temporary token and dispatch an OTP to their email
  if (user.role === "admin") {
    const otp = generateSecureOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    await authRepository.storeAdminOtp({
      id: otpId,
      userId: user.id,
      email: user.email,
      otpHash,
      expiresAt,
    });

    // Send the OTP via email service
    await sendOtpEmail({
      to: user.email,
      name: user.name,
      otp,
    });

    // Issue a short-lived temp token (valid for 5 mins) exclusively for verifying OTP
    const tempToken = generateToken({
      userId: user.id,
      role: "admin_pending_2fa",
      email: user.email,
      type: "admin_otp_session",
    });

    // Mask the email for user privacy display
    const maskedEmail = user.email.replace(/(?<=.{3}).(?=.*@)/g, "*");

    return {
      requiresOtp: true,
      tempToken,
      email: maskedEmail,
      message: `A 6-digit verification code has been dispatched to ${maskedEmail}.`,
    };
  }

  // 6. Regular users (Teacher, Student, Parent, Librarian): Generate full session token
  const token = generateToken({
    userId: user.id,
    role: user.role,
  });

  return {
    requiresOtp: false,
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

async function verifyAdminOtp(payload) {
  const { tempToken, otp } = validateVerifyOtpPayload(payload);

  // 1. Verify and decode temp token
  let decoded;
  try {
    decoded = verifyToken(tempToken);
  } catch (err) {
    const error = new Error("Session expired or invalid. Please sign in again.");
    error.statusCode = 401;
    throw error;
  }

  if (decoded.role !== "admin_pending_2fa" || decoded.type !== "admin_otp_session") {
    const error = new Error("Invalid authentication session.");
    error.statusCode = 400;
    throw error;
  }

  // 2. Fetch active OTP record for user
  const otpRecord = await authRepository.findAdminOtpByUserId(decoded.userId);
  if (!otpRecord) {
    const error = new Error("No active OTP request found. Please request a new code.");
    error.statusCode = 400;
    throw error;
  }

  // 3. Check expiration (5 minutes)
  const now = new Date();
  const expiryDate = new Date(otpRecord.expires_at);
  if (now > expiryDate) {
    await authRepository.deleteAdminOtp(otpRecord.id);
    const error = new Error("Verification code has expired. Please request a new code.");
    error.statusCode = 400;
    throw error;
  }

  // 4. Check maximum attempts limit (max 5)
  if (otpRecord.attempts >= otpRecord.max_attempts) {
    await authRepository.deleteAdminOtp(otpRecord.id);
    const error = new Error("Too many invalid attempts. For security reasons, please login again.");
    error.statusCode = 429;
    throw error;
  }

  // 5. Compare OTP with stored hash
  const isValid = await bcrypt.compare(otp, otpRecord.otp_hash);
  if (!isValid) {
    await authRepository.incrementOtpAttempts(otpRecord.id);
    const remainingAttempts = Math.max(0, otpRecord.max_attempts - (otpRecord.attempts + 1));
    const error = new Error(`Invalid verification code. ${remainingAttempts} attempts remaining.`);
    error.statusCode = 400;
    throw error;
  }

  // 6. OTP is verified! Clean up OTP record
  await authRepository.deleteAdminOtp(otpRecord.id);

  // 7. Load fresh user record
  const user = await authRepository.findUserById(decoded.userId);
  if (!user || user.status !== "active") {
    const error = new Error("User account is not accessible.");
    error.statusCode = 403;
    throw error;
  }

  // 8. Generate full Admin JWT
  const token = generateToken({
    userId: user.id,
    role: "admin",
  });

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

async function resendAdminOtp(payload) {
  const { tempToken } = validateResendOtpPayload(payload);

  let decoded;
  try {
    decoded = verifyToken(tempToken);
  } catch (err) {
    const error = new Error("Session expired. Please sign in again.");
    error.statusCode = 401;
    throw error;
  }

  if (decoded.role !== "admin_pending_2fa" || decoded.type !== "admin_otp_session") {
    const error = new Error("Invalid session token.");
    error.statusCode = 400;
    throw error;
  }

  const user = await authRepository.findUserById(decoded.userId);
  if (!user || user.role !== "admin" || user.status !== "active") {
    const error = new Error("User account is invalid or inactive.");
    error.statusCode = 403;
    throw error;
  }

  // Rate limiting check: check if an OTP was generated less than 30 seconds ago
  const existingOtp = await authRepository.findAdminOtpByUserId(user.id);
  if (existingOtp) {
    const createdAt = new Date(existingOtp.created_at).getTime();
    const elapsedSeconds = (Date.now() - createdAt) / 1000;
    if (elapsedSeconds < 30) {
      const waitTime = Math.ceil(30 - elapsedSeconds);
      const error = new Error(`Please wait ${waitTime} seconds before requesting another code.`);
      error.statusCode = 429;
      throw error;
    }
  }

  // Generate new secure OTP
  const otp = generateSecureOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await authRepository.storeAdminOtp({
    id: otpId,
    userId: user.id,
    email: user.email,
    otpHash,
    expiresAt,
  });

  await sendOtpEmail({
    to: user.email,
    name: user.name,
    otp,
  });

  // Issue refreshed temp token
  const newTempToken = generateToken({
    userId: user.id,
    role: "admin_pending_2fa",
    email: user.email,
    type: "admin_otp_session",
  });

  const maskedEmail = user.email.replace(/(?<=.{3}).(?=.*@)/g, "*");

  return {
    success: true,
    tempToken: newTempToken,
    message: `A new verification code has been dispatched to ${maskedEmail}.`,
  };
}

async function register(payload) {
  const { name, email, password } = validateRegisterPayload(payload);

  // Check if email already exists
  const existing = await authRepository.findUserForAuth(email);
  if (existing) {
    const error = new Error("An account with this email address already exists.");
    error.statusCode = 409;
    throw error;
  }

  // Hash password
  const password_hash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();

  // Create user (default role is student for public signups, or can be assigned by admin)
  const newUser = await userRepository.createUser({
    id,
    name,
    email,
    password_hash,
    role: "student",
    phone: null,
    status: "active",
  });

  // Auto-login upon registration
  const token = generateToken({
    userId: newUser.id,
    role: newUser.role,
  });

  return {
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
      status: newUser.status,
    },
  };
}

module.exports = {
  login,
  verifyAdminOtp,
  resendAdminOtp,
  register,
};
