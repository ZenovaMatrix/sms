"use strict";

/**
 * scripts/test-phase5.js
 *
 * Phase 5 Master Test Suite — Academic Management
 */

require("dotenv").config();
const http = require("http");
const pool = require("../src/config/db");
const { generateToken } = require("../src/utils/jwt");

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

async function login(email, password) {
  const r = await request("POST", "/auth/login", { body: { email, password } });
  return r.body?.data?.token || null;
}

async function run() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Phase 5 Master Test Suite — Academic Management");
  console.log(`  Target: http://localhost:${PORT}/api/v1`);
  console.log("══════════════════════════════════════════════════════\n");

  // Step 1: Capture DB baselines
  console.log("── Section 1: Capture Database Baselines ─────────────");
  const tables = [
    "users", "students", "teachers", "parents_guardians", "student_parents",
    "academic_years", "terms", "departments", "courses", "classes",
    "sections", "subjects", "enrollments", "teacher_assignments",
    "attendance_sessions", "attendance", "examinations", "exam_subjects", "results",
    "fee_structures", "student_fees", "payments",
    "library_categories", "library_books", "library_book_copies", "library_issues", "library_fines"
  ];

  const baselines = {};
  for (const t of tables) {
    const [[{ cnt }]] = await pool.execute(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
    baselines[t] = Number(cnt);
  }
  console.log("  Baseline capture complete across", tables.length, "tables.");
  assert("Database connection live", true);

  // Step 2: Acquire tokens
  console.log("\n── Section 2: Acquire Role Tokens ────────────────────");
  const adminToken = await login("admin@edumanage.com", "Password@123");
  assert("Admin token acquired", !!adminToken);

  const teacherToken = await login("amit@edumanage.com", "Password@123");
  assert("Teacher token acquired", !!teacherToken);

  const studentToken = await login("aarav@edumanage.com", "Password@123");
  assert("Student token acquired", !!studentToken);

  const student2Token = await login("ananya@edumanage.com", "Password@123");
  assert("Student 2 token acquired", !!student2Token);

  // Parent token (Suresh Sharma)
  const [[parentUser]] = await pool.execute(
    "SELECT u.id, u.role FROM users u WHERE u.email = 'suresh@edumanage.com' OR u.id = '10000000-0000-0000-0000-000000000017'"
  );
  const parentToken = generateToken({ userId: parentUser.id, role: "parent" });
  assert("Parent token acquired", !!parentToken);

  // Step 3: Phase 5A — Academic Years
  console.log("\n── Section 3: Phase 5A — Academic Years ──────────────");
  {
    const rList = await request("GET", "/academic-years", { token: adminToken });
    assert("GET /academic-years (admin) → 200", rList.status === 200);
    assert("Academic years list returns array", Array.isArray(rList.body?.data?.academicYears));
    assert("Pagination metadata present", rList.body?.data?.pagination?.total >= 1);

    const existingId = rList.body?.data?.academicYears[0]?.id;
    const rGet = await request("GET", `/academic-years/${existingId}`, { token: studentToken });
    assert("GET /academic-years/:id (student) → 200", rGet.status === 200);

    const rUnauth = await request("GET", "/academic-years");
    assert("GET /academic-years (no token) → 401", rUnauth.status === 401);

    // Non-admin cannot create
    const rStudCreate = await request("POST", "/academic-years", {
      token: studentToken,
      body: { year_name: "2090-2091", start_date: "2090-01-01", end_date: "2090-12-31" },
    });
    assert("POST /academic-years (student) → 403", rStudCreate.status === 403);

    // Invalid dates end <= start
    const rBadDate = await request("POST", "/academic-years", {
      token: adminToken,
      body: { year_name: "2090-2091", start_date: "2090-12-31", end_date: "2090-01-01" },
    });
    assert("POST /academic-years (end_date <= start_date) → 400", rBadDate.status === 400);

    // Duplicate year_name
    const rDup = await request("POST", "/academic-years", {
      token: adminToken,
      body: { year_name: rList.body?.data?.academicYears[0]?.year_name, start_date: "2090-01-01", end_date: "2090-12-31" },
    });
    assert("POST /academic-years duplicate year_name → 409", rDup.status === 409);

    // Create temp academic year
    const rCreate = await request("POST", "/academic-years", {
      token: adminToken,
      body: { year_name: "2098-2099", start_date: "2098-04-01", end_date: "2099-03-31", status: "upcoming" },
    });
    assert("POST /academic-years (admin valid) → 201", rCreate.status === 201);
    const tempYearId = rCreate.body?.data?.id;

    // PATCH temp academic year
    const rPatch = await request("PATCH", `/academic-years/${tempYearId}`, {
      token: adminToken,
      body: { status: "active" },
    });
    assert("PATCH /academic-years/:id → 200", rPatch.status === 200);

    // Cannot delete year with dependent records (existingId)
    const rDepDelete = await request("DELETE", `/academic-years/${existingId}`, { token: adminToken });
    assert("DELETE /academic-years/:id (has dependents) → 409", rDepDelete.status === 409);

    // Clean up temp academic year
    const rDelTemp = await request("DELETE", `/academic-years/${tempYearId}`, { token: adminToken });
    assert("DELETE /academic-years/:id (no dependents) → 200", rDelTemp.status === 200);
  }

  // Step 4: Phase 5B — Terms
  console.log("\n── Section 4: Phase 5B — Terms ───────────────────────");
  {
    const rList = await request("GET", "/terms", { token: teacherToken });
    assert("GET /terms (teacher) → 200", rList.status === 200);
    assert("Terms list returns array", Array.isArray(rList.body?.data?.terms));

    const existingYearId = (await pool.execute("SELECT id FROM academic_years LIMIT 1"))[0][0].id;

    // Bad date range
    const rBadTerm = await request("POST", "/terms", {
      token: adminToken,
      body: { academic_year_id: existingYearId, term_name: "Term Test", start_date: "2099-06-01", end_date: "2099-05-01" },
    });
    assert("POST /terms invalid date range → 400", rBadTerm.status === 400);

    // Create temp term
    const rCreateTerm = await request("POST", "/terms", {
      token: adminToken,
      body: { academic_year_id: existingYearId, term_name: "Special Term 99", start_date: "2027-01-01", end_date: "2027-03-15", status: "upcoming" },
    });
    assert("POST /terms (admin valid) → 201", rCreateTerm.status === 201);
    const tempTermId = rCreateTerm.body?.data?.id;

    // Duplicate term in same year
    const rDupTerm = await request("POST", "/terms", {
      token: adminToken,
      body: { academic_year_id: existingYearId, term_name: "Special Term 99", start_date: "2027-01-01", end_date: "2027-03-15" },
    });
    assert("POST /terms duplicate term_name → 409", rDupTerm.status === 409);

    // PATCH term
    const rPatchTerm = await request("PATCH", `/terms/${tempTermId}`, {
      token: adminToken,
      body: { status: "active" },
    });
    assert("PATCH /terms/:id → 200", rPatchTerm.status === 200);

    // Clean up temp term
    const rDelTerm = await request("DELETE", `/terms/${tempTermId}`, { token: adminToken });
    assert("DELETE /terms/:id → 200", rDelTerm.status === 200);
  }

  // Step 5: Phase 5C — Departments
  console.log("\n── Section 5: Phase 5C — Departments ─────────────────");
  {
    const rList = await request("GET", "/departments", { token: teacherToken });
    assert("GET /departments (teacher) → 200", rList.status === 200);

    const rStudentDep = await request("GET", "/departments", { token: studentToken });
    assert("GET /departments (student) → 403", rStudentDep.status === 403);

    // Create temp department
    const rCreateDep = await request("POST", "/departments", {
      token: adminToken,
      body: { department_name: "Astrophysics Dept", department_code: "ASTRO99", description: "Space science" },
    });
    assert("POST /departments (admin valid) → 201", rCreateDep.status === 201);
    const tempDepId = rCreateDep.body?.data?.id;

    // Duplicate department code
    const rDupDep = await request("POST", "/departments", {
      token: adminToken,
      body: { department_name: "Another Space Dept", department_code: "ASTRO99" },
    });
    assert("POST /departments duplicate code → 409", rDupDep.status === 409);

    // Delete existing department referenced by teachers → 409
    const [[activeDep]] = await pool.execute("SELECT department_id FROM teachers WHERE department_id IS NOT NULL LIMIT 1");
    const rDepBlocked = await request("DELETE", `/departments/${activeDep.department_id}`, { token: adminToken });
    assert("DELETE /departments/:id (has teachers) → 409", rDepBlocked.status === 409);

    // Clean up temp department
    const rDelDep = await request("DELETE", `/departments/${tempDepId}`, { token: adminToken });
    assert("DELETE /departments/:id (no dependents) → 200", rDelDep.status === 200);
  }

  // Step 6: Phase 5D — Courses
  console.log("\n── Section 6: Phase 5D — Courses ─────────────────────");
  {
    const rList = await request("GET", "/courses", { token: studentToken });
    assert("GET /courses (student) → 200", rList.status === 200);

    const rCreateCourse = await request("POST", "/courses", {
      token: adminToken,
      body: { course_name: "Advanced Robotics", course_code: "ROBO101", description: "Hands-on robotics" },
    });
    assert("POST /courses (admin valid) → 201", rCreateCourse.status === 201);
    const tempCourseId = rCreateCourse.body?.data?.id;

    const rDupCourse = await request("POST", "/courses", {
      token: adminToken,
      body: { course_name: "Robotics 2", course_code: "ROBO101" },
    });
    assert("POST /courses duplicate code → 409", rDupCourse.status === 409);

    const rDelCourse = await request("DELETE", `/courses/${tempCourseId}`, { token: adminToken });
    assert("DELETE /courses/:id → 200", rDelCourse.status === 200);
  }

  // Step 7: Phase 5E — Classes
  console.log("\n── Section 7: Phase 5E — Classes ─────────────────────");
  {
    const rList = await request("GET", "/classes", { token: adminToken });
    assert("GET /classes → 200", rList.status === 200);
    assert("Classes list length > 0", rList.body?.data?.classes?.length > 0);

    const rCreateClass = await request("POST", "/classes", {
      token: adminToken,
      body: { class_name: "Class 13", description: "Postgraduate preparation" },
    });
    assert("POST /classes (admin valid) → 201", rCreateClass.status === 201);
    const tempClassId = rCreateClass.body?.data?.id;

    const rDupClass = await request("POST", "/classes", {
      token: adminToken,
      body: { class_name: "Class 13" },
    });
    assert("POST /classes duplicate name → 409", rDupClass.status === 409);

    // Delete existing class with sections → 409
    const existingClassId = rList.body?.data?.classes[0]?.id;
    const rDelBlocked = await request("DELETE", `/classes/${existingClassId}`, { token: adminToken });
    assert("DELETE /classes/:id (has dependents) → 409", rDelBlocked.status === 409);

    // Delete temp class
    const rDelClass = await request("DELETE", `/classes/${tempClassId}`, { token: adminToken });
    assert("DELETE /classes/:id (temp) → 200", rDelClass.status === 200);
  }

  // Step 8: Phase 5F — Sections
  console.log("\n── Section 8: Phase 5F — Sections ────────────────────");
  {
    const rList = await request("GET", "/sections", { token: adminToken });
    assert("GET /sections → 200", rList.status === 200);

    const [[sampleClass]] = await pool.execute("SELECT id, class_name FROM classes LIMIT 1");

    // Invalid capacity <= 0
    const rBadCap = await request("POST", "/sections", {
      token: adminToken,
      body: { class_id: sampleClass.id, section_name: "Z", capacity: -5 },
    });
    assert("POST /sections capacity <= 0 → 400", rBadCap.status === 400);

    // Create temp section
    const rCreateSec = await request("POST", "/sections", {
      token: adminToken,
      body: { class_id: sampleClass.id, section_name: "Z", capacity: 40 },
    });
    assert("POST /sections (admin valid) → 201", rCreateSec.status === 201);
    const tempSecId = rCreateSec.body?.data?.id;

    // Duplicate section in same class
    const rDupSec = await request("POST", "/sections", {
      token: adminToken,
      body: { class_id: sampleClass.id, section_name: "Z", capacity: 35 },
    });
    assert("POST /sections duplicate in class → 409", rDupSec.status === 409);

    // Delete temp section
    const rDelSec = await request("DELETE", `/sections/${tempSecId}`, { token: adminToken });
    assert("DELETE /sections/:id (temp) → 200", rDelSec.status === 200);
  }

  // Step 9: Phase 5G — Subjects
  console.log("\n── Section 9: Phase 5G — Subjects ────────────────────");
  {
    const rList = await request("GET", "/subjects", { token: teacherToken });
    assert("GET /subjects → 200", rList.status === 200);

    const rCreateSub = await request("POST", "/subjects", {
      token: adminToken,
      body: { subject_name: "Astronomy", subject_code: "ASTRO101", description: "Stars and planets" },
    });
    assert("POST /subjects (admin valid) → 201", rCreateSub.status === 201);
    const tempSubId = rCreateSub.body?.data?.id;

    const rDupSub = await request("POST", "/subjects", {
      token: adminToken,
      body: { subject_name: "Astronomy 2", subject_code: "ASTRO101" },
    });
    assert("POST /subjects duplicate code → 409", rDupSub.status === 409);

    // Delete existing subject with teacher assignments → 409
    const [[subWithAssign]] = await pool.execute("SELECT subject_id FROM teacher_assignments LIMIT 1");
    const rBlockSub = await request("DELETE", `/subjects/${subWithAssign.subject_id}`, { token: adminToken });
    assert("DELETE /subjects/:id (has assignments) → 409", rBlockSub.status === 409);

    // Delete temp subject
    const rDelSub = await request("DELETE", `/subjects/${tempSubId}`, { token: adminToken });
    assert("DELETE /subjects/:id (temp) → 200", rDelSub.status === 200);
  }

  // Step 10: Phase 5H — Enrollments & Ownership
  console.log("\n── Section 10: Phase 5H — Enrollments & Ownership ────");
  {
    const rList = await request("GET", "/enrollments", { token: adminToken });
    assert("GET /enrollments (admin) → 200", rList.status === 200);
    assert("Enrollments total = 10", rList.body?.data?.pagination?.total === 10);

    // Student 1 (Aarav) reads enrollments
    const rStudList = await request("GET", "/enrollments", { token: studentToken });
    assert("GET /enrollments (student) → 200", rStudList.status === 200);
    assert("Student only receives own enrollment", rStudList.body?.data?.enrollments?.every(e => e.first_name === "Aarav"));

    // Student 1 accesses own enrollment by ID
    const ownEnrollmentId = rStudList.body?.data?.enrollments[0]?.id;
    const rOwn = await request("GET", `/enrollments/${ownEnrollmentId}`, { token: studentToken });
    assert("GET /enrollments/:id (student own) → 200", rOwn.status === 200);

    // Student 2 attempts to read Student 1's enrollment by ID → 403
    const rCrossStudent = await request("GET", `/enrollments/${ownEnrollmentId}`, { token: student2Token });
    assert("GET /enrollments/:id (cross-student) → 403", rCrossStudent.status === 403);

    // Parent (Suresh Sharma, linked to Aarav) reads enrollments
    const rParentEnroll = await request("GET", `/enrollments/${ownEnrollmentId}`, { token: parentToken });
    assert("GET /enrollments/:id (parent of linked student) → 200", rParentEnroll.status === 200);

    // Student cannot POST /enrollments → 403
    const rStudPost = await request("POST", "/enrollments", {
      token: studentToken,
      body: { student_id: rStudList.body?.data?.enrollments[0]?.student_id },
    });
    assert("POST /enrollments (student) → 403", rStudPost.status === 403);

    // Admin duplicate enrollment in same academic year → 409
    const firstEnroll = rList.body?.data?.enrollments[0];
    const rDupEnroll = await request("POST", "/enrollments", {
      token: adminToken,
      body: {
        student_id: firstEnroll.student_id,
        academic_year_id: firstEnroll.academic_year_id,
        class_id: firstEnroll.class_id,
        section_id: firstEnroll.section_id,
        enrollment_date: "2026-06-01",
      },
    });
    assert("POST /enrollments duplicate year+student → 409", rDupEnroll.status === 409);
  }

  // Step 11: Phase 5I — Teacher Assignments & Ownership
  console.log("\n── Section 11: Phase 5I — Teacher Assignments ────────");
  {
    const rList = await request("GET", "/teacher-assignments", { token: adminToken });
    assert("GET /teacher-assignments (admin) → 200", rList.status === 200);
    assert("Teacher assignments total = 5", rList.body?.data?.pagination?.total === 5);

    // Teacher (Amit Verma) gets own assignments
    const rTeacherList = await request("GET", "/teacher-assignments", { token: teacherToken });
    assert("GET /teacher-assignments (teacher) → 200", rTeacherList.status === 200);
    assert("Teacher list only contains Amit's assignments", rTeacherList.body?.data?.assignments?.every(a => a.teacher_first_name === "Amit"));

    const amitAssignmentId = rTeacherList.body?.data?.assignments[0]?.id;
    const rAmitOwn = await request("GET", `/teacher-assignments/${amitAssignmentId}`, { token: teacherToken });
    assert("GET /teacher-assignments/:id (teacher own) → 200", rAmitOwn.status === 200);

    // Find assignment belonging to other teacher
    const otherAssignment = rList.body?.data?.assignments?.find(a => a.teacher_first_name !== "Amit");
    if (otherAssignment) {
      const rCrossTeacher = await request("GET", `/teacher-assignments/${otherAssignment.id}`, { token: teacherToken });
      assert("GET /teacher-assignments/:id (cross-teacher) → 403", rCrossTeacher.status === 403);
    }

    // Teacher cannot create assignments → 403
    const rTeachPost = await request("POST", "/teacher-assignments", {
      token: teacherToken,
      body: {},
    });
    assert("POST /teacher-assignments (teacher) → 403", rTeachPost.status === 403);

    // Delete assignment with attendance sessions → 409
    const [[assignWithSessions]] = await pool.execute("SELECT teacher_assignment_id FROM attendance_sessions LIMIT 1");
    const rDelBlockedAssign = await request("DELETE", `/teacher-assignments/${assignWithSessions.teacher_assignment_id}`, { token: adminToken });
    assert("DELETE /teacher-assignments/:id (has sessions) → 409", rDelBlockedAssign.status === 409);
  }

  // Step 12: Final DB verification
  console.log("\n── Section 12: Database Count & Schema Preservation ─");
  let allCountsMatched = true;
  for (const t of tables) {
    const [[{ cnt }]] = await pool.execute(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
    const finalCount = Number(cnt);
    if (finalCount !== baselines[t]) {
      console.error(`  ❌ COUNT MISMATCH in ${t}: before=${baselines[t]}, after=${finalCount}`);
      allCountsMatched = false;
    }
  }
  assert("All database table counts 100% preserved", allCountsMatched);

  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${passed + failed} tests passed`);
  if (failed === 0) {
    console.log("  ✅ Phase 5 — ACADEMIC MANAGEMENT FULL SUITE PASSED");
  } else {
    console.log(`  ❌ Phase 5 — ${failed} TESTS FAILED`);
  }
  console.log("══════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
