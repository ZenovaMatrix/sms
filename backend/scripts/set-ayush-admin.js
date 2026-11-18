"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const pool = require("../src/config/db");
const bcrypt = require("bcryptjs");

async function updateAyushToAdmin() {
  console.log("=== Checking and Updating iamayush522@gmail.com to Admin ===");

  const email = "iamayush522@gmail.com";
  const [existing] = await pool.execute(
    "SELECT id, name, email, role, status, password_hash FROM users WHERE email = ?",
    [email]
  );

  if (existing.length === 0) {
    console.log(`User ${email} does not exist, creating as admin...`);
    const crypto = require("crypto");
    const id = crypto.randomUUID();
    const hash = await bcrypt.hash("Password@123", 10);
    await pool.execute(
      `INSERT INTO users (id, name, email, password_hash, role, phone, status)
       VALUES (?, ?, ?, ?, 'admin', NULL, 'active')`,
      [id, "Ayush (Admin)", email, hash]
    );
    console.log(`Created ${email} as admin.`);
  } else {
    const u = existing[0];
    console.log(`Found user: ${u.name} | Email: ${u.email} | Current Role: ${u.role} | Status: ${u.status}`);
    
    // Check if Password@123 matches
    const matchesDefault = await bcrypt.compare("Password@123", u.password_hash);
    console.log("Does Password@123 match current hash?", matchesDefault);
    
    // Update role to admin and ensure status is active
    let newHash = u.password_hash;
    if (!matchesDefault) {
      newHash = await bcrypt.hash("Password@123", 10);
      console.log("Updated password to Password@123");
    }

    await pool.execute(
      "UPDATE users SET role = 'admin', status = 'active', password_hash = ? WHERE email = ?",
      [newHash, email]
    );
    console.log(`✓ Successfully updated ${email} to role = 'admin' (status: active).`);
  }

  // Verify
  const [verified] = await pool.execute(
    "SELECT id, name, email, role, status FROM users WHERE email = ?",
    [email]
  );
  console.log("Verified User in DB:", verified[0]);

  await pool.end();
  process.exit(0);
}

updateAyushToAdmin().catch((err) => {
  console.error("Error updating user:", err);
  process.exit(1);
});
