"use strict";

/**
 * scripts/test-user-creation.js
 *
 * Comprehensive Test Suite for User Creation & Admin Provisioning.
 *
 * Verifies:
 *   1. Authorization / RBAC enforcement:
 *      - POST /api/v1/users without token -> 401 Unauthorized
 *      - POST /api/v1/users with teacher token -> 403 Forbidden
 *      - POST /api/v1/users with student token -> 403 Forbidden
 *   2. Input Validation (400 Bad Request):
 *      - Missing name
 *      - Missing email
 *      - Invalid email format
 *      - Missing password
 *      - Password too short (< 6 chars)
 *      - Missing role
 *      - Invalid role enum
 *      - Forbidden field injection (password_hash, id)
 *   3. Successful User Creation (201 Created):
 *      - Admin creates user with name, email, password, role, phone, status
 *      - Returns 201 with safe user object (id, name, email, role, phone, status, created_at)
 *      - NEVER exposes password_hash or password in response
 *   4. Duplicate Email Prevention (409 Conflict):
 *      - Attempting to create a user with an existing email
 *   5. Authentication & Login with New Account:
 *      - POST /api/v1/auth/login with new user credentials -> 200 OK + JWT
 *      - JWT verified: contains correct userId and role
 *      - Login with wrong password -> 401 Unauthorized
 *   6. Cleanup & Integrity:
 *      - Test user deleted from database
 *      - Initial database user row count restored
 */

require("dotenv").config();
const http = require("http");
const pool = require("../src/config/db");
const { generateToken, verifyToken } = require("../src/utils/jwt");

const PORT = process.env.PORT || 5000;
let passed = 0;
let failed = 0;

function request(method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "localhost",
      port: PORT,
      path: `/api/v1${path}`,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

async function run() {
  console.log("=================================================");
  console.log("   EduManage User Creation Test Suite");
  console.log("=================================================\n");

  let createdUserId = null;
  let initialCount = 0;
  const TEST_EMAIL = "new.librarian.test@edumanage.com";
  const TEST_PASSWORD = "SecurePassword@2026";

  try {
    // 0. Initial DB Count
    const [initialCountRows] = await pool.query("SELECT COUNT(*) AS total FROM users");
    initialCount = Number(initialCountRows[0].total);
    console.log(`Initial DB user count: ${initialCount}\n`);

    // Create tokens for testing authorization
    const adminToken = generateToken({ userId: "10000000-0000-0000-0000-000000000001", role: "admin" });
    const teacherToken = generateToken({ userId: "10000000-0000-0000-0000-000000000002", role: "teacher" });
    const studentToken = generateToken({ userId: "10000000-0000-0000-0000-000000000003", role: "student" });

    // ─── 1. AUTHORIZATION TESTS ──────────────────────────────────
    console.log("--- 1. Authorization & RBAC Checks ---");

    const noAuthRes = await request("POST", "/users", {
      body: { name: "No Auth", email: TEST_EMAIL, password: TEST_PASSWORD, role: "librarian" },
    });
    assert("POST /users without token returns 401", noAuthRes.status === 401, `Got ${noAuthRes.status}`);

    const teacherAuthRes = await request("POST", "/users", {
      body: { name: "Teacher Att", email: TEST_EMAIL, password: TEST_PASSWORD, role: "librarian" },
      token: teacherToken,
    });
    assert("POST /users with teacher token returns 403 Forbidden", teacherAuthRes.status === 403, `Got ${teacherAuthRes.status}`);

    const studentAuthRes = await request("POST", "/users", {
      body: { name: "Student Att", email: TEST_EMAIL, password: TEST_PASSWORD, role: "librarian" },
      token: studentToken,
    });
    assert("POST /users with student token returns 403 Forbidden", studentAuthRes.status === 403, `Got ${studentAuthRes.status}`);

    // ─── 2. INPUT VALIDATION TESTS (Admin token) ──────────────────
    console.log("\n--- 2. Input Validation Checks ---");

    const missingName = await request("POST", "/users", {
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, role: "librarian" },
      token: adminToken,
    });
    assert("Missing name returns 400", missingName.status === 400 && missingName.body.message.includes("Name"), `Got ${missingName.status} ${JSON.stringify(missingName.body)}`);

    const missingEmail = await request("POST", "/users", {
      body: { name: "Test User", password: TEST_PASSWORD, role: "librarian" },
      token: adminToken,
    });
    assert("Missing email returns 400", missingEmail.status === 400 && missingEmail.body.message.includes("Email"), `Got ${missingEmail.status}`);

    const invalidEmail = await request("POST", "/users", {
      body: { name: "Test User", email: "not-an-email", password: TEST_PASSWORD, role: "librarian" },
      token: adminToken,
    });
    assert("Invalid email format returns 400", invalidEmail.status === 400 && invalidEmail.body.message.includes("email format"), `Got ${invalidEmail.status}`);

    const missingPassword = await request("POST", "/users", {
      body: { name: "Test User", email: TEST_EMAIL, role: "librarian" },
      token: adminToken,
    });
    assert("Missing password returns 400", missingPassword.status === 400 && missingPassword.body.message.includes("Password"), `Got ${missingPassword.status}`);

    const shortPassword = await request("POST", "/users", {
      body: { name: "Test User", email: TEST_EMAIL, password: "123", role: "librarian" },
      token: adminToken,
    });
    assert("Password < 6 chars returns 400", shortPassword.status === 400 && shortPassword.body.message.includes("at least 6 characters"), `Got ${shortPassword.status}`);

    const missingRole = await request("POST", "/users", {
      body: { name: "Test User", email: TEST_EMAIL, password: TEST_PASSWORD },
      token: adminToken,
    });
    assert("Missing role returns 400", missingRole.status === 400 && missingRole.body.message.includes("Role"), `Got ${missingRole.status}`);

    const invalidRole = await request("POST", "/users", {
      body: { name: "Test User", email: TEST_EMAIL, password: TEST_PASSWORD, role: "superadmin" },
      token: adminToken,
    });
    assert("Invalid role enum returns 400", invalidRole.status === 400 && invalidRole.body.message.includes("Invalid role"), `Got ${invalidRole.status}`);

    const forbiddenField = await request("POST", "/users", {
      body: { name: "Test User", email: TEST_EMAIL, password: TEST_PASSWORD, role: "librarian", password_hash: "prehashed" },
      token: adminToken,
    });
    assert("Forbidden field 'password_hash' injection returns 400", forbiddenField.status === 400 && forbiddenField.body.message.includes("not allowed"), `Got ${forbiddenField.status}`);

    // ─── 3. SUCCESSFUL USER CREATION ─────────────────────────────
    console.log("\n--- 3. Successful User Creation ---");

    const createRes = await request("POST", "/users", {
      body: {
        name: "Meera Librarian",
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        role: "librarian",
        phone: "9876543210",
        status: "active",
      },
      token: adminToken,
    });

    assert("Admin creates user returns 201 Created", createRes.status === 201, `Got ${createRes.status} ${JSON.stringify(createRes.body)}`);
    assert("Response has success=true", createRes.body?.success === true);
    assert("Response data has ID", typeof createRes.body?.data?.id === "string");
    assert("Response data has correct name", createRes.body?.data?.name === "Meera Librarian");
    assert("Response data has correct email", createRes.body?.data?.email === TEST_EMAIL);
    assert("Response data has correct role", createRes.body?.data?.role === "librarian");
    assert("Response data has correct phone", createRes.body?.data?.phone === "9876543210");
    assert("Response data has status active", createRes.body?.data?.status === "active");
    assert("Response NEVER exposes password_hash", !("password_hash" in (createRes.body?.data || {})));
    assert("Response NEVER exposes raw password", !("password" in (createRes.body?.data || {})));

    createdUserId = createRes.body?.data?.id;

    // Verify DB count increased by 1
    const [duringCountRows] = await pool.query("SELECT COUNT(*) AS total FROM users");
    assert("Database count incremented by 1", Number(duringCountRows[0].total) === initialCount + 1);

    // Verify in DB that password is appropriately hashed with bcrypt (starts with $2)
    const [dbUserRows] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [createdUserId]);
    const storedHash = dbUserRows[0]?.password_hash;
    assert("DB stored password is a valid bcrypt hash", typeof storedHash === "string" && storedHash.startsWith("$2"), `Hash: ${storedHash}`);

    // ─── 4. DUPLICATE EMAIL PREVENTION ───────────────────────────
    console.log("\n--- 4. Duplicate Email Prevention ---");

    const duplicateRes = await request("POST", "/users", {
      body: {
        name: "Another Meera",
        email: TEST_EMAIL,
        password: "AnotherPassword@123",
        role: "teacher",
      },
      token: adminToken,
    });

    assert("Creating user with duplicate email returns 409 Conflict", duplicateRes.status === 409, `Got ${duplicateRes.status}`);
    assert("Duplicate email error message is descriptive", duplicateRes.body?.message?.includes("already exists"));

    // ─── 5. LOGIN WITH NEWLY CREATED ACCOUNT ─────────────────────
    console.log("\n--- 5. Login Verification with New User ---");

    // Login with incorrect password
    const wrongLoginRes = await request("POST", "/auth/login", {
      body: { email: TEST_EMAIL, password: "WrongPassword123" },
    });
    assert("Login with wrong password returns 401", wrongLoginRes.status === 401);

    // Login with correct password
    const validLoginRes = await request("POST", "/auth/login", {
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    assert("Login with new credentials returns 200 OK", validLoginRes.status === 200, `Got ${validLoginRes.status}`);
    assert("Login response includes JWT token", typeof validLoginRes.body?.data?.token === "string");
    assert("Login response has user profile", validLoginRes.body?.data?.user?.email === TEST_EMAIL);
    assert("Login profile has correct role", validLoginRes.body?.data?.user?.role === "librarian");

    // Verify JWT payload
    const decoded = verifyToken(validLoginRes.body?.data?.token);
    assert("Decoded JWT userId matches created ID", decoded.userId === createdUserId);
    assert("Decoded JWT role matches 'librarian'", decoded.role === "librarian");

    // Access role-protected test route with new token (/api/v1/auth/test/librarian)
    const libRouteRes = await request("GET", "/auth/test/librarian", {
      token: validLoginRes.body?.data?.token,
    });
    assert("New user can access role-authorized endpoint (/auth/test/librarian)", libRouteRes.status === 200);

  } finally {
    // ─── 6. CLEANUP & INTEGRITY RESTORATION ───────────────────────
    console.log("\n--- 6. Cleanup & Integrity Restoration ---");
    if (createdUserId) {
      await pool.query("DELETE FROM users WHERE id = ?", [createdUserId]);
      console.log(`  ✔ Deleted test user ${createdUserId} from database.`);
    }

    const [finalCountRows] = await pool.query("SELECT COUNT(*) AS total FROM users");
    const finalCount = Number(finalCountRows[0].total);
    console.log(`  Initial DB count: ${initialCount} | Final DB count: ${finalCount}`);
    assert("Database count perfectly restored to initial state", finalCount === initialCount);

    await pool.end();
  }

  console.log("\n=================================================");
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
