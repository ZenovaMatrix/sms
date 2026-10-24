"use strict";

/**
 * scripts/set-test-password.js
 *
 * Controlled utility to set a bcrypt password for a single specific user.
 *
 * Security:
 *   - NEVER prints or logs passwords or password hashes.
 *   - Uses parameterized SQL only.
 *   - Verifies the update using bcrypt.compare without displaying any sensitive data.
 *
 * Usage:
 *   node scripts/set-test-password.js <email> [password]
 * Example:
 *   node scripts/set-test-password.js admin@edumanage.com
 */

const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const SALT_ROUNDS = 10;
const DEFAULT_TEST_PASSWORD = "Password@123";

async function setTestPassword() {
  const emailArg = process.argv[2];
  const passwordArg = process.argv[3] || DEFAULT_TEST_PASSWORD;

  if (!emailArg) {
    console.error("Usage: node scripts/set-test-password.js <email> [password]");
    process.exit(1);
  }

  const cleanEmail = emailArg.trim().toLowerCase();

  try {
    // 1. Check if user exists
    const [rows] = await pool.execute(
      "SELECT id, name, email FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (rows.length === 0) {
      console.error(`User with email "${cleanEmail}" was not found in the database.`);
      process.exit(1);
    }

    const user = rows[0];

    // 2. Hash password securely
    const hash = await bcrypt.hash(passwordArg, SALT_ROUNDS);

    // 3. Update password_hash in database using parameterized query
    await pool.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [hash, user.id]
    );

    // 4. Verify the update without displaying the hash
    const [verifyRows] = await pool.execute(
      "SELECT password_hash FROM users WHERE id = ?",
      [user.id]
    );

    const isMatch = await bcrypt.compare(passwordArg, verifyRows[0].password_hash);
    if (!isMatch) {
      throw new Error("Password verification failed after database update.");
    }

    console.log("====================================");
    console.log("Password Update Successful");
    console.log("====================================");
    console.log(`User ID : ${user.id}`);
    console.log(`Email   : ${user.email}`);
    console.log(`Status  : Password successfully set and bcrypt verification verified.`);
    console.log("====================================");
  } catch (err) {
    console.error("Error setting password:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setTestPassword();
