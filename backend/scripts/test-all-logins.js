"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const authService = require("../src/modules/auth/auth.service");

async function testAll() {
  console.log("=== Testing All Role Logins on Backend ===");

  const cases = [
    { email: "iamayush522@gmail.com", password: "Password@123", selectedRole: "admin", label: "Admin (Ayush - iamayush522@gmail.com)" },
    { email: "admin@edumanage.com", password: "Password@123", selectedRole: "admin", label: "Admin (admin)" },
    { email: "demo@edumanage.com", password: "Demo@EduManage2026", selectedRole: "admin", label: "Demo Admin (demo)" },
    { email: "amit@edumanage.com", password: "Password@123", selectedRole: "faculty", label: "Faculty / Teacher (amit)" },
    { email: "aarav@edumanage.com", password: "Password@123", selectedRole: "student", label: "Student (aarav)" },
    { email: "sunita@edumanage.com", password: "Password@123", selectedRole: "parent", label: "Parent (sunita)" },
    { email: "mohan@edumanage.com", password: "Password@123", selectedRole: "librarian", label: "Librarian (mohan)" },
  ];

  for (const c of cases) {
    try {
      const res = await authService.login(c);
      console.log(`[PASS] ${c.label} -> requiresOtp: ${res.requiresOtp}, role: ${res.user?.role || 'admin 2FA pending'}`);
    } catch (err) {
      console.error(`[FAIL] ${c.label} -> Error: ${err.message} (status: ${err.statusCode})`);
    }
  }

  process.exit(0);
}

testAll().catch(e => { console.error(e); process.exit(1); });
