"use strict";

/**
 * scripts/create-demo-admin.js
 *
 * Creates a dedicated demo admin account for demonstration purposes.
 * This account goes through the full OTP flow — no bypasses.
 *
 * Usage: node scripts/create-demo-admin.js
 *
 * The demo admin credentials are read from .env:
 *   DEMO_ADMIN_EMAIL    (default: demo@edumanage.com)
 *   DEMO_ADMIN_PASSWORD (default: Demo@EduManage2026)
 *   DEMO_ADMIN_NAME     (default: Demo Administrator)
 *
 * The OTP will be delivered to whatever SMTP is configured.
 * If SMTP is not configured, it appears in Vercel/server logs.
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../src/config/db");

const DEMO_EMAIL    = process.env.DEMO_ADMIN_EMAIL    || "demo@edumanage.com";
const DEMO_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "Demo@EduManage2026";
const DEMO_NAME     = process.env.DEMO_ADMIN_NAME     || "Demo Administrator";

async function createDemoAdmin() {
  console.log("=== Creating Demo Admin Account ===\n");

  try {
    // Check if already exists
    const [existing] = await pool.execute(
      "SELECT id, name, email, role, status FROM users WHERE email = ?",
      [DEMO_EMAIL]
    );

    if (existing.length > 0) {
      const u = existing[0];
      console.log(`Demo admin already exists: ${u.email} (role: ${u.role}, status: ${u.status})`);

      // Update password and ensure active
      const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
      await pool.execute(
        "UPDATE users SET password_hash = ?, status = ?, name = ?, role = ? WHERE email = ?",
        [hash, "active", DEMO_NAME, "admin", DEMO_EMAIL]
      );
      console.log("Updated: password reset, status set to active, role confirmed as admin.");
    } else {
      // Create new demo admin
      const id = crypto.randomUUID();
      const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

      await pool.execute(
        `INSERT INTO users (id, name, email, password_hash, role, phone, status)
         VALUES (?, ?, ?, ?, 'admin', NULL, 'active')`,
        [id, DEMO_NAME, DEMO_EMAIL, hash]
      );
      console.log(`Created: ${DEMO_EMAIL} as admin (active)`);
    }

    // Verify password works
    const [check] = await pool.execute(
      "SELECT password_hash FROM users WHERE email = ?",
      [DEMO_EMAIL]
    );
    const verified = await bcrypt.compare(DEMO_PASSWORD, check[0].password_hash);
    console.log("Password verification:", verified ? "✓ PASS" : "✗ FAIL");

    console.log("\n=== Demo Admin Ready ===");
    console.log("Email:   ", DEMO_EMAIL);
    console.log("Role:    admin");
    console.log("Status:  active");
    console.log("OTP:     Sent to email (or visible in server logs if SMTP not configured)");
    console.log("\nFull OTP flow is enforced — no bypass.");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    await pool.end();
    process.exit(1);
  }
}

createDemoAdmin();
