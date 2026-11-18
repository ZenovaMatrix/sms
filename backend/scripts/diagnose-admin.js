"use strict";
// Diagnostic script - safe read-only inspection
require("dotenv").config({ path: "../.env" });
const pool = require("../src/config/db");
const bcrypt = require("bcryptjs");

async function diagnoseAdmin() {
  console.log("=== ADMIN DIAGNOSIS REPORT ===\n");

  // 1. Check admin user record
  console.log("--- Admin User Record ---");
  const [users] = await pool.execute(
    "SELECT id, name, email, role, status, password_hash FROM users WHERE role = ?",
    ["admin"]
  );
  console.log("Admin accounts found:", users.length);

  for (const u of users) {
    console.log({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      hasHash: !!u.password_hash,
      hashLen: u.password_hash ? u.password_hash.length : 0,
    });

    // Test known passwords
    const passwords = ["Password@123", "admin123", "Admin@123", "password", "EduManage@2026"];
    for (const pwd of passwords) {
      const match = u.password_hash ? await bcrypt.compare(pwd, u.password_hash) : false;
      if (match) console.log("  ✓ PASSWORD MATCH:", pwd);
    }
  }

  // 2. Check admin_otp table
  console.log("\n--- admin_otp Table ---");
  try {
    const [cnt] = await pool.execute("SELECT COUNT(*) AS cnt FROM admin_otp");
    console.log("Total OTP records:", cnt[0].cnt);
    const [recent] = await pool.execute(
      "SELECT id, user_id, email, expires_at, created_at FROM admin_otp ORDER BY created_at DESC LIMIT 3"
    );
    if (recent.length > 0) {
      console.log("Most recent OTPs:");
      recent.forEach((r) =>
        console.log({
          email: r.email,
          expires_at: r.expires_at,
          created_at: r.created_at,
          isExpired: new Date(r.expires_at) < new Date() ? "YES" : "NO",
        })
      );
    } else {
      console.log("No OTP records found");
    }
  } catch (e) {
    console.error("admin_otp table error:", e.message);
  }

  // 3. SMTP config
  console.log("\n--- Email (SMTP) Configuration ---");
  console.log("SMTP_HOST:", process.env.SMTP_HOST || "NOT CONFIGURED");
  console.log("SMTP_PORT:", process.env.SMTP_PORT || "NOT CONFIGURED");
  console.log("SMTP_USER:", process.env.SMTP_USER || "NOT CONFIGURED");
  console.log("SMTP_PASS:", process.env.SMTP_PASS ? "✓ SET" : "NOT CONFIGURED");
  console.log("SMTP_FROM:", process.env.SMTP_FROM || "NOT CONFIGURED");
  console.log("SMTP_SECURE:", process.env.SMTP_SECURE || "NOT CONFIGURED");
  console.log("NODE_ENV:", process.env.NODE_ENV || "not set (defaults to dev - OTP shows in logs)");

  // 4. JWT config
  console.log("\n--- JWT Configuration ---");
  console.log("JWT_SECRET length:", process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
  console.log("JWT_EXPIRES_IN:", process.env.JWT_EXPIRES_IN || "default");

  // 5. Check Demo admin account exists
  console.log("\n--- Checking for demo@edumanage.com ---");
  const [demo] = await pool.execute(
    "SELECT id, name, email, role, status FROM users WHERE email = ?",
    ["demo@edumanage.com"]
  );
  if (demo.length > 0) {
    console.log("Demo admin exists:", demo[0]);
  } else {
    console.log("No demo@edumanage.com account found.");
  }

  await pool.end();
  process.exit(0);
}

diagnoseAdmin().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
