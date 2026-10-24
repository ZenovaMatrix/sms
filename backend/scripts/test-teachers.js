"use strict";

/**
 * scripts/test-teachers.js
 *
 * Phase 4B Integration Test Suite — Teachers Module
 */

require("dotenv").config();
const http = require("http");
const mysql = require("mysql2/promise");
const { generateToken } = require("../src/utils/jwt");

const PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${PORT}/api/v1`;

let pool;

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

function noPasswordHash(body) {
  return !JSON.stringify(body).includes("password_hash");
}

async function login(email, password) {
  const r = await request("POST", "/auth/login", { body: { email, password } });
  return r.body?.data?.token || null;
}

async function run() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Phase 4B — Teachers Module Test Suite");
  console.log(`  Target: ${BASE}`);
  console.log("══════════════════════════════════════════════════════\n");

  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "edumanage",
  });

  // Test 1 — DB check
  console.log("── Test 1: Database connection ──────────────────────");
  {
    const [rows] = await pool.execute("SELECT 1 AS ok");
    assert("MySQL pool connection", rows[0].ok === 1);
  }

  // Pre-test baseline counts
  console.log("\n── Pre-test: Baseline DB counts ─────────────────────");
  let baselineTeacherCount, baselineUserCount;
  {
    const [tc] = await pool.execute("SELECT COUNT(*) AS cnt FROM teachers");
    baselineTeacherCount = Number(tc[0].cnt);
    const [uc] = await pool.execute("SELECT COUNT(*) AS cnt FROM users");
    baselineUserCount = Number(uc[0].cnt);
    console.log(`  ℹ️  Teachers: ${baselineTeacherCount}`);
    console.log(`  ℹ️  Users: ${baselineUserCount}`);
    assert("Baseline teachers = 5", baselineTeacherCount === 5, `got=${baselineTeacherCount}`);
    assert("Baseline users = 22", baselineUserCount === 22, `got=${baselineUserCount}`);
  }

  // Tokens
  console.log("\n── Obtain tokens ────────────────────────────────────");
  const adminToken = await login("admin@edumanage.com", "Password@123");
  assert("Admin token obtained", !!adminToken);

  // Teacher 1: Amit Verma (user_id = 10000000-0000-0000-0000-000000000002)
  const teacher1Token = await login("amit@edumanage.com", "Password@123");
  assert("Teacher 1 token obtained (amit)", !!teacher1Token);

  // Teacher 2: Priya Singh (user_id = 10000000-0000-0000-0000-000000000003)
  const teacher2Token = generateToken({
    userId: "10000000-0000-0000-0000-000000000003",
    role: "teacher",
  });
  assert("Teacher 2 token generated (priya)", !!teacher2Token);

  // Student token
  const studentToken = await login("aarav@edumanage.com", "Password@123");
  assert("Student token obtained (aarav)", !!studentToken);

  // Parent token
  const parentToken = generateToken({
    userId: "10000000-0000-0000-0000-000000000017",
    role: "parent",
  });
  assert("Parent token generated (suresh)", !!parentToken);

  const TEACHER1_ID = "91000000-0000-0000-0000-000000000001"; // Amit
  const TEACHER1_USER_ID = "10000000-0000-0000-0000-000000000002";
  const TEACHER2_ID = "91000000-0000-0000-0000-000000000002"; // Priya
  const TEACHER2_USER_ID = "10000000-0000-0000-0000-000000000003";
  const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000999";

  // Test 2 — GET /teachers (admin)
  console.log("\n── Test 2: GET /teachers (admin) ────────────────────");
  {
    const r = await request("GET", "/teachers", { token: adminToken });
    assert("GET /teachers → 200", r.status === 200, `status=${r.status}`);
    assert("GET /teachers → success=true", r.body?.success === true);
    assert("GET /teachers → data.teachers is array", Array.isArray(r.body?.data?.teachers));
    assert("GET /teachers → total = 5", r.body?.data?.pagination?.total === 5);
    assert("GET /teachers → no password_hash", noPasswordHash(r.body));
  }

  // Test 3 — GET /teachers (teacher)
  console.log("\n── Test 3: GET /teachers (teacher) ──────────────────");
  {
    const r = await request("GET", "/teachers", { token: teacher1Token });
    assert("GET /teachers as teacher → 200", r.status === 200);
    assert("GET /teachers → array returned", Array.isArray(r.body?.data?.teachers));
  }

  // Test 4 — Pagination
  console.log("\n── Test 4: Pagination ───────────────────────────────");
  {
    const r = await request("GET", "/teachers?page=1&limit=2", { token: adminToken });
    assert("Pagination page=1&limit=2 → 200", r.status === 200);
    assert("Returns 2 teachers", r.body?.data?.teachers?.length === 2);
    assert("totalPages = 3", r.body?.data?.pagination?.totalPages === 3);

    const r2 = await request("GET", "/teachers?limit=200", { token: adminToken });
    assert("Limit capped at 100", r2.body?.data?.pagination?.limit === 100);
  }

  // Test 5 — Search
  console.log("\n── Test 5: Search ───────────────────────────────────");
  {
    const r = await request("GET", "/teachers?search=Amit", { token: adminToken });
    assert("Search 'Amit' → 200", r.status === 200);
    assert("Search result = Amit Verma", r.body?.data?.teachers?.[0]?.first_name === "Amit");

    const r2 = await request("GET", "/teachers?search=EMP001", { token: adminToken });
    assert("Search employee_id 'EMP001' → 1 result", r2.body?.data?.teachers?.length === 1);

    const r3 = await request("GET", "/teachers?search=NONEXISTENTXYZ999", { token: adminToken });
    assert("Search no match → 0 results", r3.body?.data?.teachers?.length === 0);
  }

  // Test 6 — GET /teachers/:id (admin found)
  console.log("\n── Test 6: GET /teachers/:id (admin found) ──────────");
  {
    const r = await request("GET", `/teachers/${TEACHER1_ID}`, { token: adminToken });
    assert("GET /teachers/:id → 200", r.status === 200);
    assert("Correct teacher returned", r.body?.data?.employee_id === "EMP001");
    assert("Department name present", !!r.body?.data?.department_name);
    assert("No password_hash", noPasswordHash(r.body));
  }

  // Test 7 — GET /teachers/:id (nonexistent → 404)
  console.log("\n── Test 7: GET /teachers/:id (not found → 404) ──────");
  {
    const r = await request("GET", `/teachers/${NONEXISTENT_ID}`, { token: adminToken });
    assert("GET nonexistent teacher → 404", r.status === 404);
    assert("Error message = 'Teacher not found'", r.body?.message === "Teacher not found");
  }

  // Test 8 — GET /teachers/user/:userId
  console.log("\n── Test 8: GET /teachers/user/:userId ───────────────");
  {
    const r = await request("GET", `/teachers/user/${TEACHER1_USER_ID}`, { token: adminToken });
    assert("GET /teachers/user/:userId → 200", r.status === 200);
    assert("Correct record returned", r.body?.data?.id === TEACHER1_ID);

    const r404 = await request("GET", `/teachers/user/${NONEXISTENT_ID}`, { token: adminToken });
    assert("GET nonexistent userId → 404", r404.status === 404);
  }

  // Test 9 — Teacher ownership on GET
  console.log("\n── Test 9: Teacher ownership on GET ─────────────────");
  {
    // Teacher 1 accessing own record
    const rOwn = await request("GET", `/teachers/${TEACHER1_ID}`, { token: teacher1Token });
    assert("Teacher GET own record → 200", rOwn.status === 200);

    const rOwnUser = await request("GET", `/teachers/user/${TEACHER1_USER_ID}`, { token: teacher1Token });
    assert("Teacher GET own /user/:userId → 200", rOwnUser.status === 200);

    // Teacher 1 accessing Teacher 2
    const rOther = await request("GET", `/teachers/${TEACHER2_ID}`, { token: teacher1Token });
    assert("Teacher GET other teacher record → 403", rOther.status === 403);

    const rOtherUser = await request("GET", `/teachers/user/${TEACHER2_USER_ID}`, { token: teacher1Token });
    assert("Teacher GET other teacher /user/:userId → 403", rOtherUser.status === 403);
  }

  // Test 10 — Student & Parent access to /teachers endpoints → 403
  console.log("\n── Test 10: Student & Parent access → 403 ───────────");
  {
    const rStuList = await request("GET", "/teachers", { token: studentToken });
    assert("Student GET /teachers → 403", rStuList.status === 403);

    const rStuId = await request("GET", `/teachers/${TEACHER1_ID}`, { token: studentToken });
    assert("Student GET /teachers/:id → 403", rStuId.status === 403);

    const rParentList = await request("GET", "/teachers", { token: parentToken });
    assert("Parent GET /teachers → 403", rParentList.status === 403);

    const rParentId = await request("GET", `/teachers/${TEACHER1_ID}`, { token: parentToken });
    assert("Parent GET /teachers/:id → 403", rParentId.status === 403);
  }

  // Test 11 — Unauthenticated requests → 401
  console.log("\n── Test 11: Unauthenticated requests → 401 ──────────");
  {
    const rNoToken = await request("GET", "/teachers");
    assert("GET /teachers no token → 401", rNoToken.status === 401);

    const rBadToken = await request("GET", `/teachers/${TEACHER1_ID}`, { token: "bad.token" });
    assert("GET /teachers/:id bad token → 401", rBadToken.status === 401);
  }

  // Test 12 — Safe PATCH with MySQL verification and restoration
  console.log("\n── Test 12: Safe PATCH, DB verification & restoration");
  {
    const [rows] = await pool.execute(
      "SELECT phone, qualification FROM teachers WHERE id = ?",
      [TEACHER1_ID]
    );
    const originalPhone = rows[0].phone;
    const originalQual = rows[0].qualification;

    const PATCH_PHONE = "9876599999";
    const PATCH_QUAL = "Ph.D Mathematics";

    // Admin updates teacher
    const rPatch = await request("PATCH", `/teachers/${TEACHER1_ID}`, {
      token: adminToken,
      body: { phone: PATCH_PHONE, qualification: PATCH_QUAL },
    });
    assert("Admin PATCH teacher → 200", rPatch.status === 200);
    assert("Phone updated in response", rPatch.body?.data?.phone === PATCH_PHONE);
    assert("Qualification updated in response", rPatch.body?.data?.qualification === PATCH_QUAL);

    // Verify in DB
    const [checkRows] = await pool.execute(
      "SELECT phone, qualification FROM teachers WHERE id = ?",
      [TEACHER1_ID]
    );
    assert("MySQL phone verified", checkRows[0].phone === PATCH_PHONE);
    assert("MySQL qualification verified", checkRows[0].qualification === PATCH_QUAL);

    // Restore
    const rRestore = await request("PATCH", `/teachers/${TEACHER1_ID}`, {
      token: adminToken,
      body: { phone: originalPhone, qualification: originalQual },
    });
    assert("Restore PATCH → 200", rRestore.status === 200);

    const [restoredRows] = await pool.execute(
      "SELECT phone, qualification FROM teachers WHERE id = ?",
      [TEACHER1_ID]
    );
    assert("MySQL phone restored", restoredRows[0].phone === originalPhone);
    assert("MySQL qualification restored", restoredRows[0].qualification === originalQual);
  }

  // Test 13 — Teacher PATCH own record & other teacher 403
  console.log("\n── Test 13: Teacher PATCH own vs other ──────────────");
  {
    const [rows] = await pool.execute("SELECT phone FROM teachers WHERE id = ?", [TEACHER1_ID]);
    const origPhone = rows[0].phone;

    // Teacher 1 updates self
    const rSelf = await request("PATCH", `/teachers/${TEACHER1_ID}`, {
      token: teacher1Token,
      body: { phone: "9876511111" },
    });
    assert("Teacher PATCH own record → 200", rSelf.status === 200);

    // Restore
    await pool.execute("UPDATE teachers SET phone = ? WHERE id = ?", [origPhone, TEACHER1_ID]);

    // Teacher 1 tries to update Teacher 2
    const rOther = await request("PATCH", `/teachers/${TEACHER2_ID}`, {
      token: teacher1Token,
      body: { phone: "9876522222" },
    });
    assert("Teacher PATCH other teacher → 403", rOther.status === 403);
  }

  // Test 14 — PATCH validation (forbidden, unknown, empty)
  console.log("\n── Test 14: PATCH validation errors → 400 ───────────");
  {
    const rForbidden = await request("PATCH", `/teachers/${TEACHER1_ID}`, {
      token: adminToken,
      body: { employee_id: "EMP999" },
    });
    assert("PATCH forbidden employee_id → 400", rForbidden.status === 400);

    const rUnknown = await request("PATCH", `/teachers/${TEACHER1_ID}`, {
      token: adminToken,
      body: { random_column: "xyz" },
    });
    assert("PATCH unknown field → 400", rUnknown.status === 400);

    const rEmpty = await request("PATCH", `/teachers/${TEACHER1_ID}`, {
      token: adminToken,
      body: {},
    });
    assert("PATCH empty body → 400", rEmpty.status === 400);
  }

  // Test 15 — POST /teachers → 501
  console.log("\n── Test 15: POST /teachers → 501 ────────────────────");
  {
    const r = await request("POST", "/teachers", {
      token: adminToken,
      body: { first_name: "Test", last_name: "Teacher" },
    });
    assert("POST /teachers → 501", r.status === 501);
  }

  // Test 16 — DELETE /teachers/:id → 501
  console.log("\n── Test 16: DELETE /teachers/:id → 501 ──────────────");
  {
    const r = await request("DELETE", `/teachers/${TEACHER1_ID}`, { token: adminToken });
    assert("DELETE /teachers/:id → 501", r.status === 501);
  }

  // Test 17 — Integrity check
  console.log("\n── Test 17: Database counts preserved ───────────────");
  {
    const [tc] = await pool.execute("SELECT COUNT(*) AS cnt FROM teachers");
    assert("Teacher count unchanged (5)", Number(tc[0].cnt) === baselineTeacherCount);

    const [uc] = await pool.execute("SELECT COUNT(*) AS cnt FROM users");
    assert("User count unchanged (22)", Number(uc[0].cnt) === baselineUserCount);
  }

  // Summary
  const total = passed + failed;
  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${total} tests passed`);
  if (failed === 0) {
    console.log("  ✅ Phase 4B — ALL TESTS PASSED");
  } else {
    console.log(`  ❌ Phase 4B — ${failed} TEST(S) FAILED`);
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
