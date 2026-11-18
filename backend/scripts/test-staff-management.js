"use strict";

require("dotenv").config({ path: "./backend/.env" });
const userService = require("../src/modules/users/user.service");
const pool = require("../src/config/db");

async function runTests() {
  console.log("=== Testing Staff Account Creation & Management Logic ===");

  const timestamp = Date.now();
  const testStaffEmail = `test_librarian_${timestamp}@edumanage.com`;

  try {
    // 1. Create a staff member (Librarian)
    console.log("1. Creating Librarian account...");
    const newStaff = await userService.createUser({
      name: "Test Librarian Officer",
      email: testStaffEmail,
      password: "StaffPassword@123",
      role: "librarian",
      phone: "+1-555-0199",
      status: "active",
    });
    console.log("✓ Librarian created successfully:", newStaff.email, "(ID:", newStaff.id, ")");

    // 2. Resend invitation / activation email
    console.log("2. Resending activation email...");
    const resendRes = await userService.resendInvitation(newStaff.id);
    console.log("✓ Resend result:", resendRes.message);

    // 3. Toggle status (active -> inactive)
    console.log("3. Deactivating account...");
    const deactivated = await userService.toggleUserStatus(newStaff.id);
    console.log("✓ Deactivation result: status is now", deactivated.status);

    // 4. Toggle status back (inactive -> active)
    console.log("4. Reactivating account...");
    const reactivated = await userService.toggleUserStatus(newStaff.id);
    console.log("✓ Reactivation result: status is now", reactivated.status);

    // 5. Update staff details
    console.log("5. Updating staff phone and name...");
    const updated = await userService.updateUser(newStaff.id, {
      name: "Updated Librarian Head",
      phone: "+1-555-0200",
    });
    console.log("✓ Updated user details:", updated.name, updated.phone);

    // Clean up test staff user
    await pool.execute("DELETE FROM users WHERE email = ?", [testStaffEmail]);
    console.log("✓ Test cleanup completed.");

    console.log("\n=== ALL STAFF MANAGEMENT LOGIC TESTS PASSED ===");
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("✗ Test failed:", err);
    await pool.end();
    process.exit(1);
  }
}

runTests();
