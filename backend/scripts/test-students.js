/**
 * test-students.js
 *
 * Phase 4A Integration Test Suite — Students Module
 *
 * Tests 31 scenarios covering:
 *   - Database connection
 *   - Health check
 *   - GET /students (pagination, search)
 *   - GET /students/:id (found, not found, ownership)
 *   - GET /students/user/:userId (found, not found, ownership)
 *   - password_hash never exposed
 *   - PATCH (valid fields, DB verification, restoration, forbidden/unknown/empty body)
 *   - RBAC: unauthorized, student self-access, cross-student access, teacher, admin
 *   - POST disabled → 501
 *   - DELETE disabled → 501
 *   - Final count integrity (students = 10, users = 22)
 *   - Phase 3A / 3B / 3C regression
 *
 * Prerequisites:
 *   - Backend running on PORT (default 5000)
 *   - All users have password "Password@123" (set via set-test-password.js)
 *   - Database: edumanage, students = 10, users = 22
 *
 * Usage: node scripts/test-students.js
 */

"use strict";

require("dotenv").config();
const http = require("http");
const mysql = require("mysql2/promise");
const { generateToken } = require("../src/utils/jwt");

const PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${PORT}/api/v1`;

// ─── DB Pool ─────────────────────────────────────────────────────────────────
let pool;

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

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

// ─── Assert Helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

/**
 * Recursively checks that the string "password_hash" does NOT appear
 * anywhere in the serialized response body.
 */
function noPasswordHash(body) {
  const serialized = JSON.stringify(body);
  return !serialized.includes("password_hash");
}

// ─── Login Helper ─────────────────────────────────────────────────────────────

async function login(email, password) {
  const r = await request("POST", "/auth/login", { body: { email, password } });
  return r.body?.data?.token || null;
}

// ─── Main Test Runner ─────────────────────────────────────────────────────────

async function run() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Phase 4A — Students Module Test Suite");
  console.log(`  Target: ${BASE}`);
  console.log("══════════════════════════════════════════════════════\n");

  // ── Pre-test: connect pool for DB verification ────────────────────────────
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "edumanage",
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1 — Database connection
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("── Test 1: Database connection ──────────────────────");
  try {
    const [rows] = await pool.execute("SELECT 1 AS ok");
    assert("MySQL pool connection", rows[0].ok === 1);
  } catch (err) {
    assert("MySQL pool connection", false, err.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Health endpoint
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 2: Health endpoint ──────────────────────────");
  {
    const r = await request("GET", "/health");
    assert("GET /health → 200", r.status === 200, `status=${r.status}`);
    assert(
      "GET /health → success=true",
      r.body?.success === true,
      JSON.stringify(r.body)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Pre-test: record baseline counts
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Pre-test: Baseline DB counts ─────────────────────");
  let baselineStudentCount, baselineUserCount;
  {
    const [sc] = await pool.execute("SELECT COUNT(*) AS cnt FROM students");
    baselineStudentCount = Number(sc[0].cnt);
    const [uc] = await pool.execute("SELECT COUNT(*) AS cnt FROM users");
    baselineUserCount = Number(uc[0].cnt);
    console.log(`  ℹ️  Students: ${baselineStudentCount}`);
    console.log(`  ℹ️  Users: ${baselineUserCount}`);
    assert("Baseline students = 10", baselineStudentCount === 10, `got=${baselineStudentCount}`);
    assert("Baseline users = 22", baselineUserCount === 22, `got=${baselineUserCount}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Obtain tokens
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Obtain tokens ────────────────────────────────────");
  const adminToken = await login("admin@edumanage.com", "Password@123");
  assert("Admin token obtained", !!adminToken);

  const teacherToken = await login("amit@edumanage.com", "Password@123");
  assert("Teacher token obtained", !!teacherToken);

  // Student 1: Aarav Sharma — user_id = 10000000-0000-0000-0000-000000000007
  const student1Token = await login("aarav@edumanage.com", "Password@123");
  assert("Student-1 token obtained (aarav)", !!student1Token);

  // Student 2: Ananya Verma — user_id = 10000000-0000-0000-0000-000000000008
  const student2Token = await login("ananya@edumanage.com", "Password@123");
  assert("Student-2 token obtained (ananya)", !!student2Token);

  // Parent: Suresh Sharma — user_id = 10000000-0000-0000-0000-000000000017
  const parentToken = generateToken({
    userId: "10000000-0000-0000-0000-000000000017",
    role: "parent",
  });
  assert("Parent token obtained (suresh)", !!parentToken);

  // Known student IDs from schema inspection
  const STUDENT1_ID = "90000000-0000-0000-0000-000000000001"; // Aarav
  const STUDENT1_USER_ID = "10000000-0000-0000-0000-000000000007";
  const STUDENT2_ID = "90000000-0000-0000-0000-000000000002"; // Ananya
  const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000999";
  const NONEXISTENT_USER_ID = "00000000-0000-0000-0000-000000000999";

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3 — GET /students (admin)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 3: GET /students (admin) ────────────────────");
  {
    const r = await request("GET", "/students", { token: adminToken });
    assert("GET /students → 200", r.status === 200, `status=${r.status}`);
    assert("GET /students → success=true", r.body?.success === true);
    assert("GET /students → data.students is array", Array.isArray(r.body?.data?.students));
    assert("GET /students → pagination present", !!r.body?.data?.pagination);
    assert("GET /students → students.length > 0", r.body?.data?.students?.length > 0, `length=${r.body?.data?.students?.length}`);
    assert("GET /students → total correct", r.body?.data?.pagination?.total === 10, `total=${r.body?.data?.pagination?.total}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 4 — Pagination
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 4: Pagination ───────────────────────────────");
  {
    const r = await request("GET", "/students?page=1&limit=3", { token: adminToken });
    assert("Pagination page=1&limit=3 → 200", r.status === 200);
    assert("Pagination returns 3 students", r.body?.data?.students?.length === 3, `got=${r.body?.data?.students?.length}`);
    assert("Pagination.page = 1", r.body?.data?.pagination?.page === 1);
    assert("Pagination.limit = 3", r.body?.data?.pagination?.limit === 3);
    assert("Pagination.totalPages = 4", r.body?.data?.pagination?.totalPages === 4, `got=${r.body?.data?.pagination?.totalPages}`);
  }

  {
    // Page 2
    const r = await request("GET", "/students?page=2&limit=3", { token: adminToken });
    assert("Pagination page=2&limit=3 → 200", r.status === 200);
    assert("Pagination page=2 returns 3 students", r.body?.data?.students?.length === 3);
  }

  {
    // limit > 100 capped to 100
    const r = await request("GET", "/students?limit=500", { token: adminToken });
    assert("Limit capped at 100", r.body?.data?.pagination?.limit === 100, `got=${r.body?.data?.pagination?.limit}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 5 — Search
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 5: Search ───────────────────────────────────");
  {
    const r = await request("GET", "/students?search=Aarav", { token: adminToken });
    assert("Search 'Aarav' → 200", r.status === 200);
    assert("Search 'Aarav' → 1 result", r.body?.data?.students?.length === 1, `got=${r.body?.data?.students?.length}`);
    assert("Search result = Aarav Sharma", r.body?.data?.students?.[0]?.first_name === "Aarav");
  }

  {
    const r = await request("GET", "/students?search=STU2026001", { token: adminToken });
    assert("Search by student_id 'STU2026001' → 1 result", r.body?.data?.students?.length === 1);
  }

  {
    const r = await request("GET", "/students?search=NONEXISTENTXYZ999", { token: adminToken });
    assert("Search no match → 0 results", r.body?.data?.students?.length === 0);
    assert("Search no match → total = 0", r.body?.data?.pagination?.total === 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 6 — GET /students/:id (admin — found)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 6: GET /students/:id (found) ───────────────");
  {
    const r = await request("GET", `/students/${STUDENT1_ID}`, { token: adminToken });
    assert("GET /students/:id → 200", r.status === 200, `status=${r.status}`);
    assert("GET /students/:id → success=true", r.body?.success === true);
    assert("GET /students/:id → correct student", r.body?.data?.student_id === "STU2026001", `got=${r.body?.data?.student_id}`);
    assert("GET /students/:id → user_id present", !!r.body?.data?.user_id);
    assert("GET /students/:id → linked_user_role present", r.body?.data?.linked_user_role === "student", `got=${r.body?.data?.linked_user_role}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 7 — GET /students/:id (not found → 404)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 7: GET /students/:id (not found) ────────────");
  {
    const r = await request("GET", `/students/${NONEXISTENT_ID}`, { token: adminToken });
    assert("GET nonexistent student → 404", r.status === 404, `status=${r.status}`);
    assert("GET nonexistent → success=false", r.body?.success === false);
    assert("GET nonexistent → 'Student not found'", r.body?.message === "Student not found", `msg=${r.body?.message}`);
    assert("GET nonexistent → data=null", r.body?.data === null);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 8 — GET /students/user/:userId (found)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 8: GET /students/user/:userId ───────────────");
  {
    const r = await request("GET", `/students/user/${STUDENT1_USER_ID}`, { token: adminToken });
    assert("GET /students/user/:userId → 200", r.status === 200, `status=${r.status}`);
    assert("GET /students/user/:userId → correct record", r.body?.data?.student_id === "STU2026001", `got=${r.body?.data?.student_id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 9 — GET /students/user/:userId (not found → 404)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 9: GET /students/user/:userId (not found) ───");
  {
    const r = await request("GET", `/students/user/${NONEXISTENT_USER_ID}`, { token: adminToken });
    assert("GET nonexistent user ID → 404", r.status === 404, `status=${r.status}`);
    assert("GET nonexistent user ID → 'Student not found'", r.body?.message === "Student not found");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 10 — password_hash never exposed
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 10: password_hash never exposed ──────────────");
  {
    const r1 = await request("GET", "/students", { token: adminToken });
    assert("GET /students — no password_hash", noPasswordHash(r1.body), "password_hash found in response!");

    const r2 = await request("GET", `/students/${STUDENT1_ID}`, { token: adminToken });
    assert("GET /students/:id — no password_hash", noPasswordHash(r2.body), "password_hash found in response!");

    const r3 = await request("GET", `/students/user/${STUDENT1_USER_ID}`, { token: adminToken });
    assert("GET /students/user/:userId — no password_hash", noPasswordHash(r3.body), "password_hash found in response!");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 11 — PATCH valid student field (capture original first)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 11: PATCH valid field ────────────────────────");

  // Capture original values from DB before patching
  let originalPhone, originalAddress;
  {
    const [rows] = await pool.execute(
      "SELECT phone, address FROM students WHERE id = ?",
      [STUDENT1_ID]
    );
    originalPhone = rows[0].phone;
    originalAddress = rows[0].address;
    console.log(`  ℹ️  Original phone: ${originalPhone}`);
    console.log(`  ℹ️  Original address: ${originalAddress}`);
  }

  const PATCH_PHONE = "9999988888";
  const PATCH_ADDRESS = "Test Address, Phase 4A";

  {
    const r = await request(
      "PATCH",
      `/students/${STUDENT1_ID}`,
      {
        token: adminToken,
        body: { phone: PATCH_PHONE, address: PATCH_ADDRESS },
      }
    );
    assert("PATCH valid fields → 200", r.status === 200, `status=${r.status}`);
    assert("PATCH → success=true", r.body?.success === true);
    assert("PATCH → updated phone in response", r.body?.data?.phone === PATCH_PHONE, `got=${r.body?.data?.phone}`);
    assert("PATCH → updated address in response", r.body?.data?.address === PATCH_ADDRESS, `got=${r.body?.data?.address}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 12 — Verify PATCH in MySQL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 12: Verify PATCH in MySQL ────────────────────");
  {
    const [rows] = await pool.execute(
      "SELECT phone, address FROM students WHERE id = ?",
      [STUDENT1_ID]
    );
    assert("MySQL phone updated", rows[0].phone === PATCH_PHONE, `db_phone=${rows[0].phone}`);
    assert("MySQL address updated", rows[0].address === PATCH_ADDRESS, `db_address=${rows[0].address}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 13 — Restore original PATCH values
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 13: Restore original values ──────────────────");
  {
    const r = await request(
      "PATCH",
      `/students/${STUDENT1_ID}`,
      {
        token: adminToken,
        body: { phone: originalPhone, address: originalAddress },
      }
    );
    assert("Restore PATCH → 200", r.status === 200, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 14 — Verify exact restoration in MySQL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 14: Verify exact restoration ────────────────");
  {
    const [rows] = await pool.execute(
      "SELECT phone, address FROM students WHERE id = ?",
      [STUDENT1_ID]
    );
    assert("MySQL phone restored", rows[0].phone === originalPhone, `db=${rows[0].phone}, expected=${originalPhone}`);
    assert("MySQL address restored", rows[0].address === originalAddress, `db=${rows[0].address}, expected=${originalAddress}`);
    console.log(`  ✅ phone=${rows[0].phone}, address=${rows[0].address}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 15 — PATCH forbidden field → 400
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 15: PATCH forbidden field → 400 ─────────────");
  {
    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: adminToken,
      body: { id: "some-other-id" },
    });
    assert("PATCH forbidden 'id' → 400", r.status === 400, `status=${r.status}`);
    assert("PATCH forbidden 'id' → success=false", r.body?.success === false);
  }

  {
    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: adminToken,
      body: { user_id: "some-other-user-id" },
    });
    assert("PATCH forbidden 'user_id' → 400", r.status === 400, `status=${r.status}`);
  }

  {
    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: adminToken,
      body: { student_id: "STU9999" },
    });
    assert("PATCH forbidden 'student_id' → 400", r.status === 400, `status=${r.status}`);
  }

  {
    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: adminToken,
      body: { email: "newemail@test.com" },
    });
    assert("PATCH forbidden 'email' → 400", r.status === 400, `status=${r.status}`);
  }

  {
    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: adminToken,
      body: { password_hash: "hacked" },
    });
    assert("PATCH forbidden 'password_hash' → 400", r.status === 400, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 16 — PATCH unknown field → 400
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 16: PATCH unknown field → 400 ───────────────");
  {
    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: adminToken,
      body: { unknown_field_xyz: "value" },
    });
    assert("PATCH unknown field → 400", r.status === 400, `status=${r.status}`);
    assert("PATCH unknown field → success=false", r.body?.success === false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 17 — PATCH empty body → 400
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 17: PATCH empty body → 400 ──────────────────");
  {
    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: adminToken,
      body: {},
    });
    assert("PATCH empty body → 400", r.status === 400, `status=${r.status}`);
    assert("PATCH empty body → success=false", r.body?.success === false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 18 — Unauthorized request → 401
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 18: Unauthorized (no token) → 401 ────────────");
  {
    const r = await request("GET", "/students");
    assert("No token → 401", r.status === 401, `status=${r.status}`);
    assert("No token → success=false", r.body?.success === false);
  }

  {
    const r = await request("GET", `/students/${STUDENT1_ID}`, { token: "invalid.token.xyz" });
    assert("Bad token → 401", r.status === 401, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 19 — Student accessing another student's record → 403
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 19: Student accessing other student → 403 ───");
  {
    // student1Token belongs to Aarav (STUDENT1_ID), trying to access Ananya (STUDENT2_ID)
    const r = await request("GET", `/students/${STUDENT2_ID}`, { token: student1Token });
    assert("Student accessing other student's record → 403", r.status === 403, `status=${r.status}`);
    assert("Cross-student access → success=false", r.body?.success === false);
  }

  {
    // Student 1 trying to PATCH Student 2
    const r = await request("PATCH", `/students/${STUDENT2_ID}`, {
      token: student1Token,
      body: { phone: "9999900000" },
    });
    assert("Student PATCH other student → 403", r.status === 403, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 20 — Student accessing own record → 200
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 20: Student accessing own record → 200 ──────");
  {
    const r = await request("GET", `/students/${STUDENT1_ID}`, { token: student1Token });
    assert("Student GET own record → 200", r.status === 200, `status=${r.status}`);
    assert("Student GET own record → success=true", r.body?.success === true);
    assert("Student GET own → correct student_id", r.body?.data?.student_id === "STU2026001");
  }

  {
    // Student accessing own record via user/:userId
    const r = await request("GET", `/students/user/${STUDENT1_USER_ID}`, { token: student1Token });
    assert("Student GET own /user/:userId → 200", r.status === 200, `status=${r.status}`);
  }

  {
    // Student PATCH own record (capture + restore)
    const [orig] = await pool.execute("SELECT phone FROM students WHERE id = ?", [STUDENT1_ID]);
    const origPhone = orig[0].phone;

    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: student1Token,
      body: { phone: "8888877777" },
    });
    assert("Student PATCH own record → 200", r.status === 200, `status=${r.status}`);

    // Restore
    await pool.execute("UPDATE students SET phone = ? WHERE id = ?", [origPhone, STUDENT1_ID]);
    const [check] = await pool.execute("SELECT phone FROM students WHERE id = ?", [STUDENT1_ID]);
    assert("Student PATCH own — phone restored", check[0].phone === origPhone);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 21 — Parent access to student endpoints → 403
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 21: Parent access to student endpoints → 403 ───");
  {
    const r1 = await request("GET", "/students", { token: parentToken });
    assert("Parent GET /students → 403", r1.status === 403, `status=${r1.status}`);

    const r2 = await request("GET", `/students/${STUDENT1_ID}`, { token: parentToken });
    assert("Parent GET /students/:id → 403", r2.status === 403, `status=${r2.status}`);

    const r3 = await request("GET", `/students/user/${STUDENT1_USER_ID}`, { token: parentToken });
    assert("Parent GET /students/user/:userId → 403", r3.status === 403, `status=${r3.status}`);

    const r4 = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: parentToken,
      body: { phone: "9876543210" },
    });
    assert("Parent PATCH /students/:id → 403", r4.status === 403, `status=${r4.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 22 — Teacher access → 200
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 22: Teacher access ───────────────────────────");
  {
    const r = await request("GET", "/students", { token: teacherToken });
    assert("Teacher GET /students → 200", r.status === 200, `status=${r.status}`);
  }

  {
    const r = await request("GET", `/students/${STUDENT1_ID}`, { token: teacherToken });
    assert("Teacher GET /students/:id → 200", r.status === 200, `status=${r.status}`);
  }

  {
    const r = await request("GET", `/students/user/${STUDENT1_USER_ID}`, { token: teacherToken });
    assert("Teacher GET /students/user/:userId → 200", r.status === 200, `status=${r.status}`);
  }

  {
    // Teacher cannot PATCH (not in authorized roles)
    const r = await request("PATCH", `/students/${STUDENT1_ID}`, {
      token: teacherToken,
      body: { phone: "1111111111" },
    });
    assert("Teacher PATCH /students/:id → 403", r.status === 403, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 22 — Admin access → 200
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 22: Admin access ─────────────────────────────");
  {
    const r = await request("GET", "/students", { token: adminToken });
    assert("Admin GET /students → 200", r.status === 200, `status=${r.status}`);
  }

  {
    const r = await request("GET", `/students/${STUDENT1_ID}`, { token: adminToken });
    assert("Admin GET /students/:id → 200", r.status === 200, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 23 — Student cannot create another student → 403
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 23: Student cannot POST /students → 403 ─────");
  {
    const r = await request("POST", "/students", {
      token: student1Token,
      body: { first_name: "Hacker", last_name: "Student" },
    });
    assert("Student POST /students → 403", r.status === 403, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 24 — Teacher cannot create student → 403
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 24: Teacher cannot POST /students → 403 ─────");
  {
    const r = await request("POST", "/students", {
      token: teacherToken,
      body: { first_name: "Fake", last_name: "Student" },
    });
    assert("Teacher POST /students → 403", r.status === 403, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 25 — Admin POST → 501 (disabled Phase 4A)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 25: Admin POST → 501 (disabled) ─────────────");
  {
    const r = await request("POST", "/students", {
      token: adminToken,
      body: { first_name: "Test", last_name: "Student" },
    });
    assert("Admin POST /students → 501", r.status === 501, `status=${r.status}`);
    assert("Admin POST /students → success=false", r.body?.success === false);
    console.log(`  ℹ️  POST blocker message: ${r.body?.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 26 — DELETE → 501 (disabled)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 26: DELETE → 501 (disabled) ─────────────────");
  {
    const r = await request("DELETE", `/students/${STUDENT1_ID}`, { token: adminToken });
    assert("Admin DELETE /students/:id → 501", r.status === 501, `status=${r.status}`);
    assert("DELETE → success=false", r.body?.success === false);
    console.log(`  ℹ️  DELETE message: ${r.body?.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 27 — Final student count unchanged
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 27: Final student count unchanged ────────────");
  {
    const [sc] = await pool.execute("SELECT COUNT(*) AS cnt FROM students");
    const finalCount = Number(sc[0].cnt);
    assert(
      `Student count unchanged (${baselineStudentCount})`,
      finalCount === baselineStudentCount,
      `final=${finalCount}`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 28 — Final user count = 22
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 28: Final user count = 22 ───────────────────");
  {
    const [uc] = await pool.execute("SELECT COUNT(*) AS cnt FROM users");
    const finalUserCount = Number(uc[0].cnt);
    assert("User count = 22", finalUserCount === 22, `final=${finalUserCount}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 29 — Phase 3A regression (GET /users)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 29: Phase 3A regression ─────────────────────");
  {
    const r = await request("GET", "/users");
    assert("GET /users → 200 (Phase 3A)", r.status === 200, `status=${r.status}`);
    assert("GET /users → success=true", r.body?.success === true);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 30 — Phase 3B regression (POST /auth/login)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 30: Phase 3B regression ─────────────────────");
  {
    const r = await request("POST", "/auth/login", {
      body: { email: "admin@edumanage.com", password: "Password@123" },
    });
    assert("POST /auth/login → 200 (Phase 3B)", r.status === 200, `status=${r.status}`);
    assert("POST /auth/login → token present", !!r.body?.data?.token);
  }

  {
    const r = await request("POST", "/auth/login", {
      body: { email: "admin@edumanage.com", password: "WrongPassword" },
    });
    assert("POST /auth/login wrong password → 401", r.status === 401, `status=${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 31 — Phase 3C regression (RBAC middleware)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── Test 31: Phase 3C regression ─────────────────────");
  {
    const r = await request("GET", "/auth/me", { token: adminToken });
    assert("GET /auth/me (admin) → 200 (Phase 3C)", r.status === 200, `status=${r.status}`);
    assert("GET /auth/me → role=admin", r.body?.data?.role === "admin");
  }

  {
    const r = await request("GET", "/auth/test/admin", { token: adminToken });
    assert("GET /auth/test/admin (admin) → 200 (Phase 3C)", r.status === 200);
  }

  {
    const r = await request("GET", "/auth/test/admin", { token: teacherToken });
    assert("GET /auth/test/admin (teacher) → 403 (Phase 3C)", r.status === 403);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Final Summary
  // ═══════════════════════════════════════════════════════════════════════════
  const total = passed + failed;
  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${total} tests passed`);
  if (failed === 0) {
    console.log("  ✅ Phase 4A — ALL TESTS PASSED");
  } else {
    console.log(`  ❌ Phase 4A — ${failed} TEST(S) FAILED`);
  }
  console.log("══════════════════════════════════════════════════════\n");

  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(async (err) => {
  console.error("Fatal error:", err.message);
  if (pool) {
    try { await pool.end(); } catch {}
  }
  process.exit(1);
});
