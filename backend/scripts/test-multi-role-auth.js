"use strict";

require("dotenv").config({ path: "./backend/.env" });
const authService = require("../src/modules/auth/auth.service");

async function runTests() {
  console.log("=== Running Multi-Role Authentication Verification ===");

  // 1. Role match: Teacher login with faculty role
  try {
    const res = await authService.login({
      email: "amit@edumanage.com",
      password: "Password@123",
      selectedRole: "faculty",
    });
    console.log("[PASS] Faculty login successful -> role:", res.user.role, "requiresOtp:", res.requiresOtp);
  } catch (e) {
    console.error("[FAIL] Faculty login:", e.message);
  }

  // 2. Role match: Student login with student role
  try {
    const res = await authService.login({
      email: "aarav@edumanage.com",
      password: "Password@123",
      selectedRole: "student",
    });
    console.log("[PASS] Student login successful -> role:", res.user.role, "requiresOtp:", res.requiresOtp);
  } catch (e) {
    console.error("[FAIL] Student login:", e.message);
  }

  // 3. Role match: Parent login with parent role
  try {
    const res = await authService.login({
      email: "sunita@edumanage.com",
      password: "Password@123",
      selectedRole: "parent",
    });
    console.log("[PASS] Parent login successful -> role:", res.user.role, "requiresOtp:", res.requiresOtp);
  } catch (e) {
    console.error("[FAIL] Parent login:", e.message);
  }

  // 4. Role match: Librarian login with librarian role
  try {
    const res = await authService.login({
      email: "mohan@edumanage.com",
      password: "Password@123",
      selectedRole: "librarian",
    });
    console.log("[PASS] Librarian login successful -> role:", res.user.role, "requiresOtp:", res.requiresOtp);
  } catch (e) {
    console.error("[FAIL] Librarian login:", e.message);
  }

  // 5. Role mismatch: Student selects Admin Portal
  try {
    await authService.login({
      email: "aarav@edumanage.com",
      password: "Password@123",
      selectedRole: "admin",
    });
    console.error("[FAIL] Student selecting Admin should have thrown 403!");
  } catch (e) {
    console.log("[PASS] Student selecting Admin rejected ->", e.message, `(status: ${e.statusCode})`);
  }

  // 6. Role mismatch: Teacher selects Student Portal
  try {
    await authService.login({
      email: "amit@edumanage.com",
      password: "Password@123",
      selectedRole: "student",
    });
    console.error("[FAIL] Teacher selecting Student should have thrown 403!");
  } catch (e) {
    console.log("[PASS] Teacher selecting Student rejected ->", e.message, `(status: ${e.statusCode})`);
  }

  // 7. Register: Block Admin registration
  try {
    await authService.register({
      name: "Hacker Admin",
      email: "hacker@admin.com",
      password: "Password@123",
      role: "admin",
    });
    console.error("[FAIL] Public admin registration should have thrown 403!");
  } catch (e) {
    console.log("[PASS] Public admin registration blocked ->", e.message, `(status: ${e.statusCode})`);
  }

  // 8. Register: Block Faculty registration
  try {
    await authService.register({
      name: "Fake Teacher",
      email: "fake@teacher.com",
      password: "Password@123",
      role: "faculty",
    });
    console.error("[FAIL] Public faculty registration should have thrown 403!");
  } catch (e) {
    console.log("[PASS] Public faculty registration blocked ->", e.message, `(status: ${e.statusCode})`);
  }

  // 9. Register: Block Librarian registration
  try {
    await authService.register({
      name: "Fake Librarian",
      email: "fake@librarian.com",
      password: "Password@123",
      role: "librarian",
    });
    console.error("[FAIL] Public librarian registration should have thrown 403!");
  } catch (e) {
    console.log("[PASS] Public librarian registration blocked ->", e.message, `(status: ${e.statusCode})`);
  }

  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
