"use strict";

/**
 * scripts/test-auth.js
 *
 * Comprehensive test suite for Phase 3B: Authentication, Password Hashing & JWT.
 *
 * Tests:
 *   1. Database connection check
 *   2. Login route exists
 *   3. Missing email -> 400
 *   4. Missing password -> 400
 *   5. Invalid email format -> 400
 *   6. Invalid credentials -> 401 (generic message)
 *   7. Valid login -> 200
 *   8. JWT token is returned
 *   9. JWT contains userId and role only as required
 *   10. password_hash is not returned in login response
 *   11. password is not returned in login response
 *   12. JWT verification utility behavior (valid and invalid token)
 *   13. Inactive user -> 403
 *   14. Suspended user -> 403
 *   15. Phase 3A GET users still works
 *   16. Phase 3A PATCH restrictions and 501s still work
 *   17. User count remains exactly 22
 *   18. Database schema remains unchanged
 *
 * Security & Integrity:
 *   - Captures original password_hash and status before tests.
 *   - Restores exact original password_hash, status, and updated_at after tests.
 *   - Never logs passwords or password hashes.
 */

const http = require("http");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");
const { verifyToken } = require("../src/utils/jwt");

const TARGET_EMAIL = "admin@edumanage.com";
const TEST_PASSWORD = "AuthTestPassword@2026";
const SALT_ROUNDS = 10;

function request(options, data) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: "localhost",
      port: 5000,
      ...options,
    };

    const req = http.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on("error", reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runAuthTests() {
  console.log("==================================================");
  console.log(" EduManage Phase 3B Authentication Test Suite");
  console.log("==================================================\n");

  const results = [];
  let originalPasswordHash = null;
  let originalStatus = null;
  let originalUpdatedAt = null;
  let targetUserId = null;
  let initialSchema = null;
  let initialUserCount = null;

  try {
    // ----------------------------------------------------------------
    // Pre-test Baseline & Target User Snapshot
    // ----------------------------------------------------------------
    const [userRows] = await pool.execute(
      "SELECT id, password_hash, status, updated_at FROM users WHERE email = ?",
      [TARGET_EMAIL]
    );

    if (userRows.length === 0) {
      throw new Error(`Target test user ${TARGET_EMAIL} not found in database.`);
    }

    targetUserId = userRows[0].id;
    originalPasswordHash = userRows[0].password_hash;
    originalStatus = userRows[0].status;
    originalUpdatedAt = userRows[0].updated_at;

    const [cntRows] = await pool.query("SELECT COUNT(*) AS total FROM users;");
    initialUserCount = cntRows[0].total;

    const [schemaRows] = await pool.query("SHOW CREATE TABLE users;");
    initialSchema = schemaRows[0]["Create Table"];

    console.log(`Target User ID     : ${targetUserId}`);
    console.log(`Target User Email  : ${TARGET_EMAIL}`);
    console.log(`Initial User Count : ${initialUserCount}`);
    console.log("Baseline captured successfully.\n");

    // Temporarily set test password for target user
    const hashedTestPassword = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);
    await pool.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [hashedTestPassword, targetUserId]
    );

    // ----------------------------------------------------------------
    // TEST 1: Database Connection Works
    // ----------------------------------------------------------------
    const [select1] = await pool.query("SELECT 1 AS ok;");
    const test1Passed = select1[0].ok === 1;
    console.log(`1. Database connection check: ${test1Passed ? "PASSED" : "FAILED"}`);
    results.push({ test: 1, name: "Database connection check", passed: test1Passed });

    // ----------------------------------------------------------------
    // TEST 2: Login Route Exists
    // ----------------------------------------------------------------
    const t2 = await request({
      path: "/api/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, {});
    const test2Passed = t2.status !== 404;
    console.log(`2. Login route exists: ${test2Passed ? "PASSED" : "FAILED"} (HTTP ${t2.status})`);
    results.push({ test: 2, name: "Login route exists", passed: test2Passed });

    // ----------------------------------------------------------------
    // TEST 3: Missing Email -> 400
    // ----------------------------------------------------------------
    const t3 = await request({
      path: "/api/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { password: "somePassword" });
    const test3Passed = t3.status === 400 && t3.body.message === "Email is required.";
    console.log(`3. Missing email check: ${test3Passed ? "PASSED" : "FAILED"} (HTTP ${t3.status}, message: "${t3.body.message}")`);
    results.push({ test: 3, name: "Missing email -> 400", passed: test3Passed });

    // ----------------------------------------------------------------
    // TEST 4: Missing Password -> 400
    // ----------------------------------------------------------------
    const t4 = await request({
      path: "/api/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { email: TARGET_EMAIL });
    const test4Passed = t4.status === 400 && t4.body.message === "Password is required.";
    console.log(`4. Missing password check: ${test4Passed ? "PASSED" : "FAILED"} (HTTP ${t4.status}, message: "${t4.body.message}")`);
    results.push({ test: 4, name: "Missing password -> 400", passed: test4Passed });

    // ----------------------------------------------------------------
    // TEST 5: Invalid Email Format -> 400
    // ----------------------------------------------------------------
    const t5 = await request({
      path: "/api/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { email: "not-a-valid-email", password: "somePassword" });
    const test5Passed = t5.status === 400 && t5.body.message === "Invalid email format.";
    console.log(`5. Invalid email format check: ${test5Passed ? "PASSED" : "FAILED"} (HTTP ${t5.status}, message: "${t5.body.message}")`);
    results.push({ test: 5, name: "Invalid email format -> 400", passed: test5Passed });

    // ----------------------------------------------------------------
    // TEST 6: Invalid Credentials -> 401
    // ----------------------------------------------------------------
    const t6 = await request({
      path: "/api/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { email: TARGET_EMAIL, password: "WrongPassword@999" });
    const test6Passed = t6.status === 401 && t6.body.message === "Invalid email or password";
    console.log(`6. Invalid credentials check: ${test6Passed ? "PASSED" : "FAILED"} (HTTP ${t6.status}, message: "${t6.body.message}")`);
    results.push({ test: 6, name: "Invalid credentials -> 401", passed: test6Passed });

    // ----------------------------------------------------------------
    // TEST 7: Valid Login -> 200
    // ----------------------------------------------------------------
    const t7 = await request({
      path: "/api/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { email: TARGET_EMAIL, password: TEST_PASSWORD });
    const test7Passed = t7.status === 200 && t7.body.success === true && t7.body.message === "Login successful";
    console.log(`7. Valid login check: ${test7Passed ? "PASSED" : "FAILED"} (HTTP ${t7.status}, message: "${t7.body.message}")`);
    results.push({ test: 7, name: "Valid login -> 200", passed: test7Passed });

    // ----------------------------------------------------------------
    // TEST 8: JWT Token is Returned
    // ----------------------------------------------------------------
    const token = t7.body.data?.token;
    const test8Passed = typeof token === "string" && token.length > 20;
    console.log(`8. JWT token returned check: ${test8Passed ? "PASSED" : "FAILED"} (Token length: ${token ? token.length : 0})`);
    results.push({ test: 8, name: "JWT token returned", passed: test8Passed });

    // ----------------------------------------------------------------
    // TEST 9: JWT Contains userId and role only as required
    // ----------------------------------------------------------------
    let decoded = null;
    try {
      decoded = verifyToken(token);
    } catch {
      decoded = null;
    }
    const hasRequiredClaims = decoded && decoded.userId === targetUserId && decoded.role === "admin";
    const hasNoSensitiveClaims = decoded && !decoded.password && !decoded.password_hash && !decoded.email;
    const test9Passed = hasRequiredClaims && hasNoSensitiveClaims;
    console.log(`9. JWT payload claims check: ${test9Passed ? "PASSED" : "FAILED"} (userId: ${decoded?.userId}, role: ${decoded?.role})`);
    results.push({ test: 9, name: "JWT contains userId and role only", passed: test9Passed });

    // ----------------------------------------------------------------
    // TEST 10: password_hash is NOT Returned
    // ----------------------------------------------------------------
    const responseString = JSON.stringify(t7.body);
    const test10Passed = !responseString.includes("password_hash");
    console.log(`10. password_hash exposure check: ${test10Passed ? "PASSED (Safe)" : "FAILED (Exposed!)"}`);
    results.push({ test: 10, name: "password_hash not returned", passed: test10Passed });

    // ----------------------------------------------------------------
    // TEST 11: password is NOT Returned
    // ----------------------------------------------------------------
    const test11Passed = t7.body.data?.user?.password === undefined && !responseString.includes(`"password"`);
    console.log(`11. password exposure check: ${test11Passed ? "PASSED (Safe)" : "FAILED (Exposed!)"}`);
    results.push({ test: 11, name: "password not returned", passed: test11Passed });

    // ----------------------------------------------------------------
    // TEST 12: Invalid Token Behavior
    // ----------------------------------------------------------------
    let invalidTokenCaught = false;
    try {
      verifyToken("malformed.jwt.token");
    } catch (err) {
      invalidTokenCaught = err.statusCode === 401;
    }
    console.log(`12. Invalid token verification check: ${invalidTokenCaught ? "PASSED" : "FAILED"}`);
    results.push({ test: 12, name: "Invalid token verification check", passed: invalidTokenCaught });

    // ----------------------------------------------------------------
    // TEST 13: Inactive User -> 403
    // ----------------------------------------------------------------
    await pool.execute("UPDATE users SET status = 'inactive' WHERE id = ?", [targetUserId]);
    const t13 = await request({
      path: "/api/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { email: TARGET_EMAIL, password: TEST_PASSWORD });
    const test13Passed = t13.status === 403 && t13.body.message === "User account is inactive";
    console.log(`13. Inactive user check: ${test13Passed ? "PASSED" : "FAILED"} (HTTP ${t13.status}, message: "${t13.body.message}")`);
    results.push({ test: 13, name: "Inactive user -> 403", passed: test13Passed });

    // ----------------------------------------------------------------
    // TEST 14: Suspended User -> 403
    // ----------------------------------------------------------------
    await pool.execute("UPDATE users SET status = 'suspended' WHERE id = ?", [targetUserId]);
    const t14 = await request({
      path: "/api/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { email: TARGET_EMAIL, password: TEST_PASSWORD });
    const test14Passed = t14.status === 403 && t14.body.message === "User account is suspended";
    console.log(`14. Suspended user check: ${test14Passed ? "PASSED" : "FAILED"} (HTTP ${t14.status}, message: "${t14.body.message}")`);
    results.push({ test: 14, name: "Suspended user -> 403", passed: test14Passed });

    // ----------------------------------------------------------------
    // TEST 15: Existing Phase 3A GET Users Still Works
    // ----------------------------------------------------------------
    const t15Health = await request({ path: "/api/v1/health", method: "GET" });
    const t15Users = await request({ path: "/api/v1/users", method: "GET" });
    const test15Passed =
      t15Health.status === 200 &&
      t15Users.status === 200 &&
      t15Users.body.data?.pagination?.total === 22 &&
      !JSON.stringify(t15Users.body).includes("password_hash");
    console.log(`15. Phase 3A GET regression check: ${test15Passed ? "PASSED" : "FAILED"}`);
    results.push({ test: 15, name: "Phase 3A GET users still works", passed: test15Passed });

    // ----------------------------------------------------------------
    // TEST 16: Existing Phase 3A PATCH Restrictions & 501s Still Work
    // ----------------------------------------------------------------
    const t16PatchRole = await request({
      path: `/api/v1/users/${targetUserId}`,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    }, { role: "student" });
    const t16PostUser = await request({
      path: "/api/v1/users",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, { name: "Disabled" });
    const t16DeleteUser = await request({
      path: `/api/v1/users/${targetUserId}`,
      method: "DELETE",
    });

    const test16Passed =
      t16PatchRole.status === 400 &&
      (t16PostUser.status === 401 || t16PostUser.status === 501) &&
      t16DeleteUser.status === 501;
    console.log(`16. Phase 3A PATCH/DELETE restrictions & POST auth check: ${test16Passed ? "PASSED" : "FAILED"}`);
    results.push({ test: 16, name: "Phase 3A PATCH/DELETE restrictions still work", passed: test16Passed });

    // ----------------------------------------------------------------
    // Restoration of Target User State
    // ----------------------------------------------------------------
    await pool.execute(
      "UPDATE users SET password_hash = ?, status = ?, updated_at = ? WHERE id = ?",
      [originalPasswordHash, originalStatus, originalUpdatedAt, targetUserId]
    );

    const [restoredRows] = await pool.execute(
      "SELECT password_hash, status, updated_at FROM users WHERE id = ?",
      [targetUserId]
    );

    const hashRestored = restoredRows[0].password_hash === originalPasswordHash;
    const statusRestored = restoredRows[0].status === originalStatus;
    const updatedAtRestored =
      new Date(restoredRows[0].updated_at).getTime() === new Date(originalUpdatedAt).getTime();

    console.log("\nRestoration Verification:");
    console.log(`  - password_hash restored identical?: ${hashRestored ? "PASSED" : "FAILED"}`);
    console.log(`  - status restored identical?       : ${statusRestored ? "PASSED" : "FAILED"}`);
    console.log(`  - updated_at restored identical?   : ${updatedAtRestored ? "PASSED" : "FAILED"}`);

    // ----------------------------------------------------------------
    // TEST 17: User Count Remains 22
    // ----------------------------------------------------------------
    const [finalCntRows] = await pool.query("SELECT COUNT(*) AS total FROM users;");
    const finalUserCount = finalCntRows[0].total;
    const test17Passed = finalUserCount === initialUserCount && finalUserCount === 22 && hashRestored && statusRestored;
    console.log(`17. Final user count check: ${test17Passed ? "PASSED" : "FAILED"} (Count: ${finalUserCount})`);
    results.push({ test: 17, name: "User count remains 22", passed: test17Passed });

    // ----------------------------------------------------------------
    // TEST 18: Database Schema Remains Unchanged
    // ----------------------------------------------------------------
    const [finalSchemaRows] = await pool.query("SHOW CREATE TABLE users;");
    const finalSchema = finalSchemaRows[0]["Create Table"];
    const test18Passed = finalSchema === initialSchema;
    console.log(`18. Database schema immutability check: ${test18Passed ? "PASSED" : "FAILED"}`);
    results.push({ test: 18, name: "Database schema remains unchanged", passed: test18Passed });

  } catch (err) {
    console.error("Test execution error:", err);
    // Ensure restoration even if error occurred mid-way
    if (targetUserId && originalPasswordHash) {
      await pool.execute(
        "UPDATE users SET password_hash = ?, status = ?, updated_at = ? WHERE id = ?",
        [originalPasswordHash, originalStatus, originalUpdatedAt, targetUserId]
      );
      console.log("Emergency state restoration completed.");
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }

  console.log("\n==================================================");
  console.log("             PHASE 3B TEST SUMMARY                ");
  console.log("==================================================");
  let allPassed = true;
  for (const r of results) {
    console.log(`Test ${r.test.toString().padStart(2, " ")} [${r.name}]: ${r.passed ? "PASSED" : "FAILED"}`);
    if (!r.passed) allPassed = false;
  }
  console.log("==================================================");
  console.log("OVERALL RESULT:", allPassed ? "ALL 18 TESTS PASSED" : "SOME TESTS FAILED");
  console.log("==================================================");
}

runAuthTests();
