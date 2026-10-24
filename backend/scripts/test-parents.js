"use strict";

/**
 * scripts/test-parents.js
 *
 * Phase 4C Integration Test Suite — Parents & Student-Parent Relationships
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
  console.log("  Phase 4C — Parents & Relationships Test Suite");
  console.log(`  Target: ${BASE}`);
  console.log("══════════════════════════════════════════════════════\n");

  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "edumanage",
  });

  // Test 1 — Database connection
  console.log("── Test 1: Database connection ──────────────────────");
  {
    const [rows] = await pool.execute("SELECT 1 AS ok");
    assert("MySQL pool connection", rows[0].ok === 1);
  }

  // Pre-test baseline counts
  console.log("\n── Pre-test: Baseline DB counts ─────────────────────");
  let baselineParentCount, baselineRelCount, baselineUserCount, baselineStudentCount;
  {
    const [pc] = await pool.execute("SELECT COUNT(*) AS cnt FROM parents_guardians");
    baselineParentCount = Number(pc[0].cnt);
    const [rc] = await pool.execute("SELECT COUNT(*) AS cnt FROM student_parents");
    baselineRelCount = Number(rc[0].cnt);
    const [uc] = await pool.execute("SELECT COUNT(*) AS cnt FROM users");
    baselineUserCount = Number(uc[0].cnt);
    const [sc] = await pool.execute("SELECT COUNT(*) AS cnt FROM students");
    baselineStudentCount = Number(sc[0].cnt);

    console.log(`  ℹ️  Parents: ${baselineParentCount}`);
    console.log(`  ℹ️  Relationships: ${baselineRelCount}`);
    console.log(`  ℹ️  Users: ${baselineUserCount}`);
    console.log(`  ℹ️  Students: ${baselineStudentCount}`);

    assert("Baseline parents = 5", baselineParentCount === 5, `got=${baselineParentCount}`);
    assert("Baseline relationships = 10", baselineRelCount === 10, `got=${baselineRelCount}`);
    assert("Baseline users = 22", baselineUserCount === 22, `got=${baselineUserCount}`);
    assert("Baseline students = 10", baselineStudentCount === 10, `got=${baselineStudentCount}`);
  }

  // Tokens
  console.log("\n── Obtain tokens ────────────────────────────────────");
  const adminToken = await login("admin@edumanage.com", "Password@123");
  assert("Admin token obtained", !!adminToken);

  const teacherToken = await login("amit@edumanage.com", "Password@123");
  assert("Teacher token obtained", !!teacherToken);

  // Student 1 (Aarav, user_id = 10000000-0000-0000-0000-000000000007)
  const student1Token = await login("aarav@edumanage.com", "Password@123");
  assert("Student 1 token obtained (aarav)", !!student1Token);

  // Student 2 (Ananya, user_id = 10000000-0000-0000-0000-000000000008)
  const student2Token = await login("ananya@edumanage.com", "Password@123");
  assert("Student 2 token obtained (ananya)", !!student2Token);

  // Parent 1 (Suresh Sharma, user_id = 10000000-0000-0000-0000-000000000017)
  const parent1Token = generateToken({
    userId: "10000000-0000-0000-0000-000000000017",
    role: "parent",
  });
  assert("Parent 1 token generated (suresh)", !!parent1Token);

  // Parent 2 (Sunita Verma, user_id = 10000000-0000-0000-0000-000000000018)
  const parent2Token = generateToken({
    userId: "10000000-0000-0000-0000-000000000018",
    role: "parent",
  });
  assert("Parent 2 token generated (sunita)", !!parent2Token);

  const PARENT1_ID = "92000000-0000-0000-0000-000000000001"; // Suresh Sharma
  const PARENT1_USER_ID = "10000000-0000-0000-0000-000000000017";
  const PARENT2_ID = "92000000-0000-0000-0000-000000000002"; // Sunita Verma
  const PARENT2_USER_ID = "10000000-0000-0000-0000-000000000018";
  const STUDENT1_ID = "90000000-0000-0000-0000-000000000001"; // Aarav (linked to Parent 1)
  const STUDENT2_ID = "90000000-0000-0000-0000-000000000002"; // Ananya (linked to Parent 2)
  const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000999";

  // Test 2 — GET /parents (admin only)
  console.log("\n── Test 2: GET /parents (admin only) ────────────────");
  {
    const rAdmin = await request("GET", "/parents", { token: adminToken });
    assert("Admin GET /parents → 200", rAdmin.status === 200, `status=${rAdmin.status}`);
    assert("data.parents is array", Array.isArray(rAdmin.body?.data?.parents));
    assert("total = 5", rAdmin.body?.data?.pagination?.total === 5);
    assert("no password_hash", noPasswordHash(rAdmin.body));

    const rTeacher = await request("GET", "/parents", { token: teacherToken });
    assert("Teacher GET /parents → 403", rTeacher.status === 403);

    const rStudent = await request("GET", "/parents", { token: student1Token });
    assert("Student GET /parents → 403", rStudent.status === 403);

    const rParent = await request("GET", "/parents", { token: parent1Token });
    assert("Parent GET /parents → 403", rParent.status === 403);

    const rNoAuth = await request("GET", "/parents");
    assert("Unauthenticated GET /parents → 401", rNoAuth.status === 401);
  }

  // Test 3 — GET /parents/:id (admin & parent own)
  console.log("\n── Test 3: GET /parents/:id (ownership) ─────────────");
  {
    const rAdmin = await request("GET", `/parents/${PARENT1_ID}`, { token: adminToken });
    assert("Admin GET parent by id → 200", rAdmin.status === 200);
    assert("Correct parent returned", rAdmin.body?.data?.full_name === "Suresh Sharma");

    const rOwn = await request("GET", `/parents/${PARENT1_ID}`, { token: parent1Token });
    assert("Parent GET own record → 200", rOwn.status === 200);

    const rOther = await request("GET", `/parents/${PARENT2_ID}`, { token: parent1Token });
    assert("Parent GET other parent record → 403", rOther.status === 403);

    const r404 = await request("GET", `/parents/${NONEXISTENT_ID}`, { token: adminToken });
    assert("GET nonexistent parent → 404", r404.status === 404);
  }

  // Test 4 — GET /parents/user/:userId
  console.log("\n── Test 4: GET /parents/user/:userId ────────────────");
  {
    const rAdmin = await request("GET", `/parents/user/${PARENT1_USER_ID}`, { token: adminToken });
    assert("Admin GET parent by userId → 200", rAdmin.status === 200);

    const rOwn = await request("GET", `/parents/user/${PARENT1_USER_ID}`, { token: parent1Token });
    assert("Parent GET own by userId → 200", rOwn.status === 200);

    const rOther = await request("GET", `/parents/user/${PARENT2_USER_ID}`, { token: parent1Token });
    assert("Parent GET other parent by userId → 403", rOther.status === 403);

    const r404 = await request("GET", `/parents/user/${NONEXISTENT_ID}`, { token: adminToken });
    assert("GET nonexistent parent userId → 404", r404.status === 404);
  }

  // Test 5 — Safe PATCH /parents/:id, MySQL verification & exact restoration
  console.log("\n── Test 5: Safe PATCH /parents/:id & restoration ────");
  {
    const [rows] = await pool.execute(
      "SELECT phone, occupation FROM parents_guardians WHERE id = ?",
      [PARENT1_ID]
    );
    const origPhone = rows[0].phone;
    const origOccupation = rows[0].occupation;

    const PATCH_PHONE = "9876509999";
    const PATCH_OCC = "Senior Consultant";

    // Parent updates own profile
    const rPatch = await request("PATCH", `/parents/${PARENT1_ID}`, {
      token: parent1Token,
      body: { phone: PATCH_PHONE, occupation: PATCH_OCC },
    });
    assert("Parent PATCH own record → 200", rPatch.status === 200);

    // Verify in DB
    const [check] = await pool.execute(
      "SELECT phone, occupation FROM parents_guardians WHERE id = ?",
      [PARENT1_ID]
    );
    assert("MySQL phone updated", check[0].phone === PATCH_PHONE);
    assert("MySQL occupation updated", check[0].occupation === PATCH_OCC);

    // Restore
    const rRestore = await request("PATCH", `/parents/${PARENT1_ID}`, {
      token: adminToken,
      body: { phone: origPhone, occupation: origOccupation },
    });
    assert("Restore parent profile → 200", rRestore.status === 200);

    const [restored] = await pool.execute(
      "SELECT phone, occupation FROM parents_guardians WHERE id = ?",
      [PARENT1_ID]
    );
    assert("MySQL phone restored", restored[0].phone === origPhone);
    assert("MySQL occupation restored", restored[0].occupation === origOccupation);
  }

  // Test 6 — PATCH validation & cross-parent 403
  console.log("\n── Test 6: PATCH validation & cross-parent 403 ──────");
  {
    const rForbidden = await request("PATCH", `/parents/${PARENT1_ID}`, {
      token: adminToken,
      body: { user_id: "fake-user-id" },
    });
    assert("PATCH forbidden user_id → 400", rForbidden.status === 400);

    const rUnknown = await request("PATCH", `/parents/${PARENT1_ID}`, {
      token: adminToken,
      body: { unexpected_field: "123" },
    });
    assert("PATCH unknown field → 400", rUnknown.status === 400);

    const rEmpty = await request("PATCH", `/parents/${PARENT1_ID}`, {
      token: adminToken,
      body: {},
    });
    assert("PATCH empty body → 400", rEmpty.status === 400);

    const rCross = await request("PATCH", `/parents/${PARENT2_ID}`, {
      token: parent1Token,
      body: { phone: "9876501111" },
    });
    assert("Parent PATCH other parent → 403", rCross.status === 403);
  }

  // Test 7 — POST /parents & DELETE /parents/:id → 501
  console.log("\n── Test 7: POST & DELETE /parents → 501 ─────────────");
  {
    const rPost = await request("POST", "/parents", {
      token: adminToken,
      body: { full_name: "Test Parent" },
    });
    assert("POST /parents → 501", rPost.status === 501);

    const rDel = await request("DELETE", `/parents/${PARENT1_ID}`, { token: adminToken });
    assert("DELETE /parents/:id → 501", rDel.status === 501);
  }

  // Test 8 — GET /parents/:parentId/students
  console.log("\n── Test 8: GET /parents/:parentId/students ──────────");
  {
    // Admin can view any parent's students
    const rAdmin = await request("GET", `/parents/${PARENT1_ID}/students`, { token: adminToken });
    assert("Admin GET parent students → 200", rAdmin.status === 200);
    assert("Returns linked students", rAdmin.body?.data?.length > 0);
    assert("Linked student Aarav present", rAdmin.body?.data?.some(s => s.student_id === STUDENT1_ID));
    assert("No password_hash", noPasswordHash(rAdmin.body));

    // Parent 1 views own students
    const rOwn = await request("GET", `/parents/${PARENT1_ID}/students`, { token: parent1Token });
    assert("Parent 1 GET own students → 200", rOwn.status === 200);
    assert("Contains Aarav", rOwn.body?.data?.some(s => s.student_id === STUDENT1_ID));

    // Parent 1 views Parent 2's students → 403
    const rOther = await request("GET", `/parents/${PARENT2_ID}/students`, { token: parent1Token });
    assert("Parent 1 GET Parent 2 students → 403", rOther.status === 403);

    // Student / Teacher cannot access
    const rStu = await request("GET", `/parents/${PARENT1_ID}/students`, { token: student1Token });
    assert("Student GET parent students → 403", rStu.status === 403);

    const rTeacher = await request("GET", `/parents/${PARENT1_ID}/students`, { token: teacherToken });
    assert("Teacher GET parent students → 403", rTeacher.status === 403);
  }

  // Test 9 — GET /students/:studentId/parents
  console.log("\n── Test 9: GET /students/:studentId/parents ──────────");
  {
    // Admin
    const rAdmin = await request("GET", `/students/${STUDENT1_ID}/parents`, { token: adminToken });
    assert("Admin GET student parents → 200", rAdmin.status === 200);
    assert("Returns parent list", rAdmin.body?.data?.length > 0);
    assert("Parent 1 is present", rAdmin.body?.data?.some(p => p.id === PARENT1_ID));
    assert("No password_hash", noPasswordHash(rAdmin.body));

    // Teacher
    const rTeacher = await request("GET", `/students/${STUDENT1_ID}/parents`, { token: teacherToken });
    assert("Teacher GET student parents → 200", rTeacher.status === 200);

    // Student 1 (Aarav) views own parents
    const rStuOwn = await request("GET", `/students/${STUDENT1_ID}/parents`, { token: student1Token });
    assert("Student 1 GET own parents → 200", rStuOwn.status === 200);
    assert("Parent 1 is present in student own parents", rStuOwn.body?.data?.some(p => p.id === PARENT1_ID));

    // Student 1 views Student 2's parents → 403
    const rStuOther = await request("GET", `/students/${STUDENT2_ID}/parents`, { token: student1Token });
    assert("Student 1 GET other student parents → 403", rStuOther.status === 403);

    // Parent 1 (linked to Student 1) views Student 1's parents → 200
    const rParentLinked = await request("GET", `/students/${STUDENT1_ID}/parents`, { token: parent1Token });
    assert("Linked parent GET student parents → 200", rParentLinked.status === 200);

    // Parent 1 (NOT linked to Student 2) views Student 2's parents → 403
    const rParentUnlinked = await request("GET", `/students/${STUDENT2_ID}/parents`, { token: parent1Token });
    assert("Unlinked parent GET student parents → 403", rParentUnlinked.status === 403);
  }

  // Test 10 — Relationship creation, duplicate handling & safe cleanup
  console.log("\n── Test 10: Relationship POST, duplicate 409 & cleanup");
  {
    // Duplicate test: Parent 1 + Student 1 already exists
    const rDup = await request("POST", `/parents/${PARENT1_ID}/students/${STUDENT1_ID}`, {
      token: adminToken,
      body: { relationship: "father" },
    });
    assert("Duplicate relationship → 409", rDup.status === 409);

    // Non-admin trying to create relationship → 403
    const rNonAdmin = await request("POST", `/parents/${PARENT1_ID}/students/${STUDENT2_ID}`, {
      token: parent1Token,
      body: { relationship: "guardian" },
    });
    assert("Non-admin POST relationship → 403", rNonAdmin.status === 403);

    // Create a temporary relationship between Parent 1 and Student 2 (Ananya)
    const rCreate = await request("POST", `/parents/${PARENT1_ID}/students/${STUDENT2_ID}`, {
      token: adminToken,
      body: {
        relationship: "guardian",
        is_primary_contact: 0,
        is_emergency_contact: 1,
      },
    });
    assert("Admin POST relationship → 201", rCreate.status === 201);
    assert("Created relationship returned", !!rCreate.body?.data?.id);
    const tempRelId = rCreate.body?.data?.id;

    // Verify in DB
    const [dbRows] = await pool.execute("SELECT * FROM student_parents WHERE id = ?", [tempRelId]);
    assert("Relationship verified in MySQL", dbRows.length === 1);
    assert("Relationship type is guardian", dbRows[0].relationship === "guardian");

    // Clean up temporary relationship safely
    await pool.execute("DELETE FROM student_parents WHERE id = ?", [tempRelId]);

    const [afterClean] = await pool.execute("SELECT * FROM student_parents WHERE id = ?", [tempRelId]);
    assert("Temporary relationship removed", afterClean.length === 0);
  }

  // Test 11 — DELETE relationship API → 501
  console.log("\n── Test 11: DELETE relationship API → 501 ───────────");
  {
    const rDelRel = await request("DELETE", `/parents/${PARENT1_ID}/students/${STUDENT1_ID}`, {
      token: adminToken,
    });
    assert("DELETE relationship → 501", rDelRel.status === 501);
  }

  // Test 12 — Final DB counts integrity
  console.log("\n── Test 12: Final DB counts integrity ───────────────");
  {
    const [pc] = await pool.execute("SELECT COUNT(*) AS cnt FROM parents_guardians");
    assert("Parents count unchanged (5)", Number(pc[0].cnt) === baselineParentCount);

    const [rc] = await pool.execute("SELECT COUNT(*) AS cnt FROM student_parents");
    assert("Relationships count unchanged (10)", Number(rc[0].cnt) === baselineRelCount);

    const [sc] = await pool.execute("SELECT COUNT(*) AS cnt FROM students");
    assert("Students count unchanged (10)", Number(sc[0].cnt) === baselineStudentCount);

    const [uc] = await pool.execute("SELECT COUNT(*) AS cnt FROM users");
    assert("Users count unchanged (22)", Number(uc[0].cnt) === baselineUserCount);
  }

  // Summary
  const total = passed + failed;
  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${total} tests passed`);
  if (failed === 0) {
    console.log("  ✅ Phase 4C — ALL TESTS PASSED");
  } else {
    console.log(`  ❌ Phase 4C — ${failed} TEST(S) FAILED`);
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
