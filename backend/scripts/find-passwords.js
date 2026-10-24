"use strict";
require("dotenv").config();
const pool = require("../src/config/db");
const bcrypt = require("bcryptjs");

const candidates = [
  "Admin@1234", "Teacher@1234", "Student@1234", "Password@123",
  "Test@1234", "admin123", "teacher123", "password", "Password@1234",
  "Welcome@1234", "School@123", "Edu@1234"
];

async function findPasswords() {
  const [rows] = await pool.execute(
    "SELECT email, role, password_hash FROM users ORDER BY role LIMIT 8"
  );
  for (const row of rows) {
    let found = null;
    for (const pw of candidates) {
      const ok = await bcrypt.compare(pw, row.password_hash);
      if (ok) { found = pw; break; }
    }
    console.log(`${row.role.padEnd(12)} ${row.email.padEnd(30)} => ${found || "(not found)"}`);
  }
  await pool.end();
}

findPasswords().catch(e => { console.error(e); process.exit(1); });
