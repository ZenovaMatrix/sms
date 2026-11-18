"use strict";

/**
 * otp-cache.js
 *
 * Lightweight in-memory store for demo admin OTP codes.
 * Used ONLY for the demo account to allow OTP retrieval via the API
 * without exposing production admin OTPs.
 *
 * Keys: userId → { otp, expiresAt }
 * Auto-purges expired entries.
 *
 * Security:
 * - Only the DEMO_ADMIN_EMAIL user is ever written here
 * - Entries expire after 5 minutes (same as the actual OTP)
 * - The key DEMO_PEEK_SECRET must be provided to read from it
 */

const store = new Map();

function set(userId, otp, ttlMs = 5 * 60 * 1000) {
  store.set(userId, {
    otp,
    expiresAt: Date.now() + ttlMs,
  });
}

function get(userId) {
  const entry = store.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(userId);
    return null;
  }
  return entry.otp;
}

function del(userId) {
  store.delete(userId);
}

module.exports = { set, get, del };
