"use strict";

require("dotenv").config({ path: "./backend/.env" });
const authService = require("../src/modules/auth/auth.service");
const userService = require("../src/modules/users/user.service");
const pool = require("../src/config/db");

async function runE2ETests() {
  console.log("==================================================");
  console.log("EduManage: Full E2E Admin Portal & Staff Management Test");
  console.log("==================================================\n");

  try {
    // -------------------------------------------------------------------------
    // 1. DEMO ADMIN LOGIN FLOW (Steps 1 to 5)
    // -------------------------------------------------------------------------
    console.log("STEP 1: Admin enters email and password for Demo Admin...");
    const loginRes = await authService.login({
      email: "demo@edumanage.com",
      password: "Demo@EduManage2026",
      selectedRole: "admin",
    });

    if (!loginRes.requiresOtp) {
      throw new Error("Admin login should require 2FA OTP verification.");
    }
    console.log("✓ Step 2 Passed: Backend validated credentials and initiated 2FA.");
    console.log("  - Temp Token issued for OTP session:", loginRes.tempToken.slice(0, 24) + "...");
    console.log("  - Notification:", loginRes.message);

    console.log("\nSTEP 3: 6-Digit OTP generated and dispatched.");
    const peekRes = await authService.getDemoOtp({
      tempToken: loginRes.tempToken,
      peekSecret: "EduManage-Demo-2026",
    });
    const otp = peekRes.otp;
    console.log("✓ Step 3 Passed: 6-Digit OTP retrieved from secure session:", otp);

    console.log("\nSTEP 4: Admin verifies 6-digit OTP...");
    const verifyRes = await authService.verifyAdminOtp({
      tempToken: loginRes.tempToken,
      otp,
    });
    console.log("✓ Step 4 Passed: OTP verified successfully!");
    console.log("  - Full JWT Token generated:", verifyRes.token.slice(0, 24) + "...");
    console.log("  - Authenticated Admin Identity:", verifyRes.user.name, `(${verifyRes.user.role})`);

    console.log("\nSTEP 5: Admin session confirmed for Admin Dashboard access.");
    if (verifyRes.user.role !== "admin") {
      throw new Error("Expected user role to be 'admin'.");
    }
    console.log("✓ Step 5 Passed: User is authorized for Admin Dashboard.\n");

    // -------------------------------------------------------------------------
    // 2. INSTITUTION MANAGEMENT / STAFF PROVISIONING
    // -------------------------------------------------------------------------
    console.log("==================================================");
    console.log("Testing Institution Management Staff Provisioning APIs");
    console.log("==================================================");

    const ts = Date.now();
    const testAdminEmail = `test_admin_${ts}@edumanage.com`;
    const testTeacherEmail = `test_faculty_${ts}@edumanage.com`;
    const testLibrarianEmail = `test_lib_${ts}@edumanage.com`;

    // A. Create Administrator
    console.log("\nA. Provisioning new Administrator...");
    const newAdmin = await userService.createUser({
      name: "Institutional Dean Admin",
      email: testAdminEmail,
      password: "DeanPassword@2026",
      role: "admin",
      phone: "+91-9988776655",
      status: "active",
    });
    console.log("✓ Administrator provisioned:", newAdmin.email, "role:", newAdmin.role);

    // B. Create Faculty
    console.log("\nB. Provisioning new Faculty...");
    const newTeacher = await userService.createUser({
      name: "Professor Anjali Roy",
      email: testTeacherEmail,
      password: "FacultyPassword@2026",
      role: "teacher",
      phone: "+91-9988776656",
      status: "active",
    });
    console.log("✓ Faculty provisioned:", newTeacher.email, "role:", newTeacher.role);

    // C. Create Librarian
    console.log("\nC. Provisioning new Librarian...");
    const newLib = await userService.createUser({
      name: "Senior Librarian Verma",
      email: testLibrarianEmail,
      password: "LibrarianPassword@2026",
      role: "librarian",
      phone: "+91-9988776657",
      status: "active",
    });
    console.log("✓ Librarian provisioned:", newLib.email, "role:", newLib.role);

    // D. Resend Invitation / Activation
    console.log("\nD. Resending account activation email to faculty...");
    const resendRes = await userService.resendInvitation(newTeacher.id);
    console.log("✓ Resend invitation message:", resendRes.message);

    // E. Toggle Status
    console.log("\nE. Deactivating faculty account...");
    const deactRes = await userService.toggleUserStatus(newTeacher.id);
    console.log("✓ Faculty status is now:", deactRes.status);

    console.log("   Re-activating faculty account...");
    const reactRes = await userService.toggleUserStatus(newTeacher.id);
    console.log("✓ Faculty status restored to:", reactRes.status);

    // F. Edit Details
    console.log("\nF. Editing staff details...");
    const editRes = await userService.updateUser(newLib.id, {
      name: "Senior Chief Librarian Verma",
      phone: "+91-9988776699",
      status: "active",
    });
    console.log("✓ Updated details:", editRes.name, editRes.phone);

    // Clean up created test accounts
    await pool.execute("DELETE FROM users WHERE email IN (?, ?, ?)", [
      testAdminEmail,
      testTeacherEmail,
      testLibrarianEmail,
    ]);
    console.log("\n✓ Cleaned up ephemeral test accounts from database.");

    console.log("\n==================================================");
    console.log("✓ ALL E2E ADMIN & INSTITUTION TESTS PASSED!");
    console.log("==================================================");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("✗ E2E Test Failure:", err);
    await pool.end();
    process.exit(1);
  }
}

runE2ETests();
