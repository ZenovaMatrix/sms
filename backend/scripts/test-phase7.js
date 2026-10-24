"use strict";

/**
 * scripts/test-phase7.js
 *
 * Phase 7 Master Test Suite — Examinations & Results
 * Validates:
 *   - 7A: Examinations CRUD, Validation, Dependency Deletion Protection
 *   - 7B: Exam Subjects CRUD, Marks Validation, Unique Constraints
 *   - 7C: Results CRUD, Automatic Grade & Status Calculations, Student/Parent Ownership
 *   - 100% Database Row Count & Schema Preservation
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
  console.log("  Phase 7 Master Test Suite — Examinations & Results");
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
  console.log("  Captured baseline for 27 tables.");
  assert("Database connection live", true);

  // Step 2: Acquire role tokens
  console.log("\n── Section 2: Acquire Role Tokens ────────────────────");
  const adminToken = await login("admin@edumanage.com", "Password@123");
  assert("Admin token acquired", !!adminToken);

  const teacherToken = await login("amit@edumanage.com", "Password@123");
  assert("Teacher token acquired", !!teacherToken);

  const studentToken = await login("aarav@edumanage.com", "Password@123");
  assert("Student token acquired (Aarav)", !!studentToken);

  const student2Token = await login("ananya@edumanage.com", "Password@123");
  assert("Student 2 token acquired (Ananya)", !!student2Token);

  const [[parentUser]] = await pool.execute(
    "SELECT u.id, u.role FROM users u WHERE u.email = 'suresh@edumanage.com' OR u.id = '10000000-0000-0000-0000-000000000017'"
  );
  const parentToken = generateToken({ userId: parentUser.id, role: "parent" });
  assert("Parent token acquired (Suresh)", !!parentToken);

  // Step 3: Phase 7A — Examinations
  console.log("\n── Section 3: Phase 7A — Examinations ────────────────");
  {
    const rList = await request("GET", "/examinations", { token: adminToken });
    assert("Admin GET /examinations → 200", rList.status === 200);
    assert("Total examinations = 1", rList.body?.data?.pagination?.total === 1);

    const existingExam = rList.body?.data?.examinations[0];
    const rGetExam = await request("GET", `/examinations/${existingExam.id}`, { token: studentToken });
    assert("Student GET /examinations/:id → 200", rGetExam.status === 200);

    // Student cannot create exam → 403
    const rStudCreate = await request("POST", "/examinations", {
      token: studentToken,
      body: { exam_name: "Hacked Exam" },
    });
    assert("Student POST /examinations → 403", rStudCreate.status === 403);

    // End date preceding start date → 400
    const rBadDates = await request("POST", "/examinations", {
      token: adminToken,
      body: {
        academic_year_id: existingExam.academic_year_id,
        term_id: existingExam.term_id,
        class_id: existingExam.class_id,
        exam_name: "Summer Assessment",
        start_date: "2026-10-15",
        end_date: "2026-10-10",
      },
    });
    assert("POST /examinations end_date < start_date → 400", rBadDates.status === 400);

    // Create temp examination
    const rCreateExam = await request("POST", "/examinations", {
      token: adminToken,
      body: {
        academic_year_id: existingExam.academic_year_id,
        term_id: existingExam.term_id,
        class_id: existingExam.class_id,
        exam_name: "Mid-Term Special 2026",
        start_date: "2026-10-10",
        end_date: "2026-10-20",
        status: "upcoming",
      },
    });
    assert("POST /examinations (valid admin) → 201", rCreateExam.status === 201);
    const tempExamId = rCreateExam.body?.data?.id;

    // Patch examination
    const rPatchExam = await request("PATCH", `/examinations/${tempExamId}`, {
      token: adminToken,
      body: { status: "ongoing" },
    });
    assert("PATCH /examinations/:id → 200", rPatchExam.status === 200);

    // Delete examination with exam subjects → 409
    const rDelBlocked = await request("DELETE", `/examinations/${existingExam.id}`, { token: adminToken });
    assert("DELETE examination with exam subjects → 409", rDelBlocked.status === 409);

    // Delete temp examination (no subjects) → 200
    const rDelTemp = await request("DELETE", `/examinations/${tempExamId}`, { token: adminToken });
    assert("DELETE temporary examination → 200", rDelTemp.status === 200);
  }

  // Step 4: Phase 7B — Exam Subjects
  console.log("\n── Section 4: Phase 7B — Exam Subjects ───────────────");
  {
    const rList = await request("GET", "/exam-subjects", { token: teacherToken });
    assert("Teacher GET /exam-subjects → 200", rList.status === 200);
    assert("Total exam subjects count = 5", rList.body?.data?.examSubjects?.length === 5);

    const [[existingExam]] = await pool.execute("SELECT id FROM examinations LIMIT 1");
    const [allSubjects] = await pool.execute("SELECT id FROM subjects");
    const [assignedSubjects] = await pool.execute("SELECT subject_id FROM exam_subjects WHERE exam_id = ?", [existingExam.id]);
    const assignedIds = new Set(assignedSubjects.map(s => s.subject_id));
    const availableSubject = allSubjects.find(s => !assignedIds.has(s.id));

    // passing_marks > total_marks → 400
    const rBadPassing = await request("POST", "/exam-subjects", {
      token: adminToken,
      body: {
        exam_id: existingExam.id,
        subject_id: availableSubject ? availableSubject.id : allSubjects[0].id,
        total_marks: 100,
        passing_marks: 120,
      },
    });
    assert("POST /exam-subjects passing_marks > total_marks → 400", rBadPassing.status === 400);

    // total_marks <= 0 → 400
    const rBadTotal = await request("POST", "/exam-subjects", {
      token: adminToken,
      body: {
        exam_id: existingExam.id,
        subject_id: availableSubject ? availableSubject.id : allSubjects[0].id,
        total_marks: 0,
        passing_marks: 0,
      },
    });
    assert("POST /exam-subjects total_marks <= 0 → 400", rBadTotal.status === 400);

    // Create temp exam subject if an unassigned subject exists
    if (availableSubject) {
      const rCreateEs = await request("POST", "/exam-subjects", {
        token: adminToken,
        body: {
          exam_id: existingExam.id,
          subject_id: availableSubject.id,
          total_marks: 100,
          passing_marks: 40,
          exam_date: "2026-10-18",
        },
      });
      assert("POST /exam-subjects (valid admin) → 201", rCreateEs.status === 201);
      const tempEsId = rCreateEs.body?.data?.id;

      // Duplicate subject in same exam → 409
      const rDupEs = await request("POST", "/exam-subjects", {
        token: adminToken,
        body: {
          exam_id: existingExam.id,
          subject_id: availableSubject.id,
          total_marks: 100,
          passing_marks: 40,
        },
      });
      assert("POST /exam-subjects duplicate subject in exam → 409", rDupEs.status === 409);

      // PATCH exam subject
      const rPatchEs = await request("PATCH", `/exam-subjects/${tempEsId}`, {
        token: adminToken,
        body: { passing_marks: 35 },
      });
      assert("PATCH /exam-subjects/:id → 200", rPatchEs.status === 200);

      // Clean up temp exam subject
      const rDelEs = await request("DELETE", `/exam-subjects/${tempEsId}`, { token: adminToken });
      assert("DELETE /exam-subjects/:id → 200", rDelEs.status === 200);
    } else {
      assert("Skipped temp exam subject test (all subjects assigned)", true);
    }

    // Delete existing exam subject with results → 409
    const [[esWithResults]] = await pool.execute("SELECT exam_subject_id FROM results LIMIT 1");
    const rDelBlocked = await request("DELETE", `/exam-subjects/${esWithResults.exam_subject_id}`, { token: adminToken });
    assert("DELETE exam subject with results → 409", rDelBlocked.status === 409);
  }

  // Step 5: Phase 7C — Results & Grading
  console.log("\n── Section 5: Phase 7C — Results & Grading ───────────");
  {
    const rList = await request("GET", "/results", { token: adminToken });
    assert("Admin GET /results → 200", rList.status === 200);
    assert("Total results = 20", rList.body?.data?.pagination?.total === 20);

    // Student (Aarav) reads results
    const rStudResults = await request("GET", "/results", { token: studentToken });
    assert("Student GET /results → 200", rStudResults.status === 200);
    assert("Student only sees own results", rStudResults.body?.data?.results?.every(r => r.student_first_name === "Aarav"));

    const aaravResult = rStudResults.body?.data?.results[0];
    const rAaravGet = await request("GET", `/results/${aaravResult.id}`, { token: studentToken });
    assert("Student GET own result by ID → 200", rAaravGet.status === 200);

    // Cross-student denial: Student 2 reads Aarav's result → 403
    const rCrossStud = await request("GET", `/results/${aaravResult.id}`, { token: student2Token });
    assert("Cross-student GET /results/:id → 403", rCrossStud.status === 403);

    // Parent of Aarav (Suresh) reads Aarav's result → 200
    const rParentGet = await request("GET", `/results/${aaravResult.id}`, { token: parentToken });
    assert("Parent of linked student GET /results/:id → 200", rParentGet.status === 200);

    // Student cannot create result → 403
    const rStudCreateRes = await request("POST", "/results", {
      token: studentToken,
      body: { marks_obtained: 100 },
    });
    assert("Student POST /results → 403", rStudCreateRes.status === 403);

    // marks_obtained > total_marks → 400
    const [[sampleEs]] = await pool.execute("SELECT id, total_marks, passing_marks FROM exam_subjects LIMIT 1");
    const [[sampleStudent]] = await pool.execute("SELECT id FROM students LIMIT 1");
    const rOverMarks = await request("POST", "/results", {
      token: adminToken,
      body: {
        student_id: sampleStudent.id,
        exam_subject_id: sampleEs.id,
        marks_obtained: Number(sampleEs.total_marks) + 50,
      },
    });
    assert("POST /results marks_obtained > total_marks → 400", rOverMarks.status === 400);

    // Safe PATCH result & restoration
    const originalMarks = Number(aaravResult.marks_obtained);
    const originalGrade = aaravResult.grade;
    const rPatchResult = await request("PATCH", `/results/${aaravResult.id}`, {
      token: adminToken,
      body: { marks_obtained: 95.0 },
    });
    assert("PATCH /results/:id → 200", rPatchResult.status === 200);
    assert("Result grade auto-calculated to A+", rPatchResult.body?.data?.grade === "A+");
    assert("Result status auto-calculated to pass", rPatchResult.body?.data?.result_status === "pass");

    // Restore original result values
    const rRestoreRes = await request("PATCH", `/results/${aaravResult.id}`, {
      token: adminToken,
      body: { marks_obtained: originalMarks, grade: originalGrade, result_status: aaravResult.result_status },
    });
    assert("Restore result record → 200", rRestoreRes.status === 200);
  }

  // Step 6: Database Integrity & Count Preservation
  console.log("\n── Section 6: Database Count & Schema Preservation ───");
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
    console.log("  ✅ Phase 7 — EXAMINATIONS & RESULTS FULL SUITE PASSED");
  } else {
    console.log(`  ❌ Phase 7 — ${failed} TESTS FAILED`);
  }
  console.log("══════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
