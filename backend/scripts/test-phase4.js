"use strict";

/**
 * scripts/test-phase4.js
 *
 * Phase 4D Master Integration & Full Regression Test Suite
 * Covers Students (4A), Teachers (4B), Parents & Relationships (4C), and Base APIs.
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
  console.log("  Phase 4D — Full Integration & Regression Test Suite");
  console.log(`  Target: ${BASE}`);
  console.log("══════════════════════════════════════════════════════\n");

  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "edumanage",
  });

  // 1. Health & DB
  console.log("── Section 1: Health & Database Baseline ───────────");
  {
    const [rows] = await pool.execute("SELECT 1 AS ok");
    assert("DB connection ok", rows[0].ok === 1);

    const rHealth = await request("GET", "/health");
    assert("GET /health → 200", rHealth.status === 200);

    const [uc] = await pool.execute("SELECT COUNT(*) AS cnt FROM users");
    const [sc] = await pool.execute("SELECT COUNT(*) AS cnt FROM students");
    const [tc] = await pool.execute("SELECT COUNT(*) AS cnt FROM teachers");
    const [pc] = await pool.execute("SELECT COUNT(*) AS cnt FROM parents_guardians");
    const [rc] = await pool.execute("SELECT COUNT(*) AS cnt FROM student_parents");

    assert("Baseline users = 22", Number(uc[0].cnt) === 22, `got=${uc[0].cnt}`);
    assert("Baseline students = 10", Number(sc[0].cnt) === 10, `got=${sc[0].cnt}`);
    assert("Baseline teachers = 5", Number(tc[0].cnt) === 5, `got=${tc[0].cnt}`);
    assert("Baseline parents = 5", Number(pc[0].cnt) === 5, `got=${pc[0].cnt}`);
    assert("Baseline relationships = 10", Number(rc[0].cnt) === 10, `got=${rc[0].cnt}`);
  }

  // 2. Authentication tokens
  console.log("\n── Section 2: Tokens Acquisition ───────────────────");
  const adminToken = await login("admin@edumanage.com", "Password@123");
  assert("Admin token obtained via /auth/login", !!adminToken);

  const teacherToken = await login("amit@edumanage.com", "Password@123");
  assert("Teacher token obtained via /auth/login", !!teacherToken);

  const studentToken = await login("aarav@edumanage.com", "Password@123");
  assert("Student token obtained via /auth/login", !!studentToken);

  const parentToken = generateToken({
    userId: "10000000-0000-0000-0000-000000000017",
    role: "parent",
  });
  assert("Parent token generated (Suresh)", !!parentToken);

  const STUDENT_ID = "90000000-0000-0000-0000-000000000001";
  const STUDENT_USER_ID = "10000000-0000-0000-0000-000000000007";
  const TEACHER_ID = "91000000-0000-0000-0000-000000000001";
  const TEACHER_USER_ID = "10000000-0000-0000-0000-000000000002";
  const PARENT_ID = "92000000-0000-0000-0000-000000000001";
  const PARENT_USER_ID = "10000000-0000-0000-0000-000000000017";

  // 3. Regression: Phase 3A (Users) & 3B/3C (Auth/RBAC)
  console.log("\n── Section 3: Phase 3 Regression ────────────────────");
  {
    const rUsers = await request("GET", "/users");
    assert("Phase 3A: GET /users → 200", rUsers.status === 200);

    const rMe = await request("GET", "/auth/me", { token: adminToken });
    assert("Phase 3C: GET /auth/me → 200", rMe.status === 200);
    assert("Phase 3C: role is admin", rMe.body?.data?.role === "admin");

    const rAuthAdmin = await request("GET", "/auth/test/admin", { token: adminToken });
    assert("Phase 3C: GET /auth/test/admin (admin) → 200", rAuthAdmin.status === 200);

    const rAuthAdminDenied = await request("GET", "/auth/test/admin", { token: teacherToken });
    assert("Phase 3C: GET /auth/test/admin (teacher) → 403", rAuthAdminDenied.status === 403);
  }

  // 4. Phase 4A: Students Module
  console.log("\n── Section 4: Phase 4A Students Verification ────────");
  {
    const rList = await request("GET", "/students", { token: adminToken });
    assert("GET /students (admin) → 200", rList.status === 200);
    assert("Pagination present", !!rList.body?.data?.pagination);
    assert("No password_hash in students list", noPasswordHash(rList.body));

    const rId = await request("GET", `/students/${STUDENT_ID}`, { token: studentToken });
    assert("GET /students/:id (student own) → 200", rId.status === 200);
    assert("No password_hash in student record", noPasswordHash(rId.body));

    const rUser = await request("GET", `/students/user/${STUDENT_USER_ID}`, { token: studentToken });
    assert("GET /students/user/:userId (student own) → 200", rUser.status === 200);

    const rParent403 = await request("GET", `/students/${STUDENT_ID}`, { token: parentToken });
    assert("GET /students/:id (parent) → 403", rParent403.status === 403);

    const rPost = await request("POST", "/students", { token: adminToken, body: {} });
    assert("POST /students → 501", rPost.status === 501);

    const rDelete = await request("DELETE", `/students/${STUDENT_ID}`, { token: adminToken });
    assert("DELETE /students/:id → 501", rDelete.status === 501);
  }

  // 5. Phase 4B: Teachers Module
  console.log("\n── Section 5: Phase 4B Teachers Verification ────────");
  {
    const rList = await request("GET", "/teachers", { token: teacherToken });
    assert("GET /teachers (teacher) → 200", rList.status === 200);
    assert("No password_hash in teachers list", noPasswordHash(rList.body));

    const rId = await request("GET", `/teachers/${TEACHER_ID}`, { token: teacherToken });
    assert("GET /teachers/:id (teacher own) → 200", rId.status === 200);
    assert("Department info joined", !!rId.body?.data?.department_name);

    const rStu403 = await request("GET", "/teachers", { token: studentToken });
    assert("GET /teachers (student) → 403", rStu403.status === 403);

    const rPost = await request("POST", "/teachers", { token: adminToken, body: {} });
    assert("POST /teachers → 501", rPost.status === 501);

    const rDelete = await request("DELETE", `/teachers/${TEACHER_ID}`, { token: adminToken });
    assert("DELETE /teachers/:id → 501", rDelete.status === 501);
  }

  // 6. Phase 4C: Parents & Relationships
  console.log("\n── Section 6: Phase 4C Parents & Relationships ──────");
  {
    const rList = await request("GET", "/parents", { token: adminToken });
    assert("GET /parents (admin) → 200", rList.status === 200);
    assert("No password_hash in parents list", noPasswordHash(rList.body));

    const rId = await request("GET", `/parents/${PARENT_ID}`, { token: parentToken });
    assert("GET /parents/:id (parent own) → 200", rId.status === 200);

    const rTeacher403 = await request("GET", "/parents", { token: teacherToken });
    assert("GET /parents (teacher) → 403", rTeacher403.status === 403);

    const rPost = await request("POST", "/parents", { token: adminToken, body: {} });
    assert("POST /parents → 501", rPost.status === 501);

    const rDelete = await request("DELETE", `/parents/${PARENT_ID}`, { token: adminToken });
    assert("DELETE /parents/:id → 501", rDelete.status === 501);

    // Parent's students
    const rParentStudents = await request("GET", `/parents/${PARENT_ID}/students`, { token: parentToken });
    assert("GET /parents/:parentId/students (own) → 200", rParentStudents.status === 200);
    assert("No password_hash in parent students", noPasswordHash(rParentStudents.body));

    // Student's parents
    const rStudentParents = await request("GET", `/students/${STUDENT_ID}/parents`, { token: studentToken });
    assert("GET /students/:studentId/parents (own) → 200", rStudentParents.status === 200);
    assert("No password_hash in student parents", noPasswordHash(rStudentParents.body));

    // Relationship DELETE → 501
    const rRelDel = await request("DELETE", `/parents/${PARENT_ID}/students/${STUDENT_ID}`, { token: adminToken });
    assert("DELETE relationship → 501", rRelDel.status === 501);
  }

  // 7. Database integrity check
  console.log("\n── Section 7: Final Database Integrity Check ───────");
  {
    const [uc] = await pool.execute("SELECT COUNT(*) AS cnt FROM users");
    const [sc] = await pool.execute("SELECT COUNT(*) AS cnt FROM students");
    const [tc] = await pool.execute("SELECT COUNT(*) AS cnt FROM teachers");
    const [pc] = await pool.execute("SELECT COUNT(*) AS cnt FROM parents_guardians");
    const [rc] = await pool.execute("SELECT COUNT(*) AS cnt FROM student_parents");

    assert("Users count unchanged = 22", Number(uc[0].cnt) === 22);
    assert("Students count unchanged = 10", Number(sc[0].cnt) === 10);
    assert("Teachers count unchanged = 5", Number(tc[0].cnt) === 5);
    assert("Parents count unchanged = 5", Number(pc[0].cnt) === 5);
    assert("Relationships count unchanged = 10", Number(rc[0].cnt) === 10);
  }

  // Summary
  const total = passed + failed;
  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${total} tests passed`);
  if (failed === 0) {
    console.log("  ✅ Phase 4D — MASTER INTEGRATION TESTS PASSED");
  } else {
    console.log(`  ❌ Phase 4D — ${failed} TEST(S) FAILED`);
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
