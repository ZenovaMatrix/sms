"use strict";

require("dotenv").config();
const http = require("http");
const pool = require("../src/config/db");
const { generateToken } = require("../src/utils/jwt");

let passed = 0;
let failed = 0;

function assert(description, condition, details = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description} ${details}`);
    failed++;
  }
}

function request(method, path, { token = null, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);

    const req = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path: `/api/v1${path}`,
        method,
        headers,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            data = raw;
          }
          resolve({ status: res.statusCode, body: data });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log("══════════════════════════════════════════════════════");
  console.log("  Teacher Portal End-to-End Backend Verification");
  console.log("══════════════════════════════════════════════════════");

  // Acquire admin token
  const [[adminUser]] = await pool.execute("SELECT id, role FROM users WHERE role = 'admin' LIMIT 1");
  const adminToken = generateToken({ userId: adminUser.id, role: "admin" });
  assert("Admin token generated", !!adminToken);

  // Acquire teacher Amit Verma token
  const [[amitUser]] = await pool.execute(
    "SELECT u.id, u.role FROM users u WHERE u.email = 'amit@edumanage.com' OR u.id = '10000000-0000-0000-0000-000000000002'"
  );
  const teacherToken = generateToken({ userId: amitUser.id, role: "teacher" });
  assert("Teacher Amit token generated", !!teacherToken);

  // 1. Verify Teacher GET /results
  console.log("\n── Test 1: Results Page Loads for Teacher without 500 ──");
  const resResults = await request("GET", "/results", { token: teacherToken });
  assert("Teacher GET /results returns 200 (no ReferenceError)", resResults.status === 200);
  assert("Results array returned for teacher", Array.isArray(resResults.body?.data?.results));
  console.log(`  ℹ️ Teacher sees ${resResults.body?.data?.results?.length} assigned result records.`);

  // 2. Deadlines API
  console.log("\n── Test 2: Deadlines Policy API ────────────────────────");
  const resDeadlines = await request("GET", "/deadlines", { token: teacherToken });
  assert("Teacher GET /deadlines returns 200", resDeadlines.status === 200);
  assert("Includes attendance policy", resDeadlines.body?.data?.some((p) => p.policy_type === "attendance"));
  assert("Includes grading policy", resDeadlines.body?.data?.some((p) => p.policy_type === "grading"));

  // Check window status
  const resWinAtt = await request("GET", "/deadlines/attendance-window?date=2026-01-01", { token: teacherToken });
  assert("Past date attendance window check returns isOpen: false", resWinAtt.body?.data?.isOpen === false);

  // 3. Attendance Deadline Enforcement
  console.log("\n── Test 3: Attendance Deadline Lock Enforcement ───────");
  const [[amitTa]] = await pool.execute(
    "SELECT ta.id FROM teacher_assignments ta JOIN teachers t ON t.id = ta.teacher_id WHERE t.first_name = 'Amit' LIMIT 1"
  );

  // Try creating attendance session for a past locked date as teacher
  const resPastSession = await request("POST", "/attendance/sessions", {
    token: teacherToken,
    body: {
      teacher_assignment_id: amitTa.id,
      session_date: "2025-01-01",
      start_time: "09:00:00",
      end_time: "10:00:00",
    },
  });
  assert("Teacher cannot create session for past locked date (403)", resPastSession.status === 403);
  assert(
    "Error explains deadline passed & asks for Correction Request",
    resPastSession.body?.message?.includes("Correction Request")
  );

  // 4. Attendance Correction Requests Workflow
  console.log("\n── Test 4: Attendance Correction Requests Workflow ─────");
  const [[sampleSession]] = await pool.execute("SELECT id, session_date FROM attendance_sessions LIMIT 1");
  const [[sampleStudent]] = await pool.execute("SELECT id FROM students LIMIT 1");

  const reqBody = {
    request_type: "attendance",
    target_id: sampleSession.id,
    target_date: "2026-09-06",
    proposed_changes: [
      {
        student_id: sampleStudent.id,
        status: "excused",
        remarks: "Medical leave approved late",
      },
    ],
    reason: "Student submitted medical certificate late with doctor note.",
  };

  const resSubmitCorrection = await request("POST", "/correction-requests", {
    token: teacherToken,
    body: reqBody,
  });
  assert("Teacher submits attendance correction request → 201", resSubmitCorrection.status === 201);
  const createdAttRequestId = resSubmitCorrection.body?.data?.id;
  assert("Correction request has ID", !!createdAttRequestId);

  // Teacher GET own requests
  const resTeacherRequests = await request("GET", "/correction-requests", { token: teacherToken });
  assert("Teacher GET /correction-requests → 200", resTeacherRequests.status === 200);
  assert(
    "Teacher sees created correction request",
    resTeacherRequests.body?.data?.requests?.some((r) => r.id === createdAttRequestId)
  );

  // Admin approves correction request
  const resApprove = await request("PATCH", `/correction-requests/${createdAttRequestId}/review`, {
    token: adminToken,
    body: {
      status: "approved",
      admin_notes: "Verified doctor note. Approved.",
    },
  });
  assert("Admin approves correction request → 200", resApprove.status === 200);
  assert("Status updated to approved", resApprove.body?.data?.status === "approved");

  // Verify attendance updated
  const [[updatedAtt]] = await pool.execute(
    "SELECT status, remarks FROM attendance WHERE attendance_session_id = ? AND student_id = ?",
    [sampleSession.id, sampleStudent.id]
  );
  assert("Attendance record updated to 'excused'", updatedAtt?.status === "excused");

  // Verify audit log created
  const [[auditLog]] = await pool.execute(
    "SELECT action, user_role, reason FROM audit_logs WHERE entity_type = 'attendance' ORDER BY created_at DESC LIMIT 1"
  );
  assert("Audit log recorded for attendance correction", auditLog?.action === "CORRECTION_APPROVED_ATTENDANCE");

  // 5. Results & Gradebook Workflow and Correction
  console.log("\n── Test 5: Gradebook Results Security & Correction ────");
  // Find an exam subject taught by Amit
  const [[amitExamSub]] = await pool.execute(
    `SELECT es.id, es.total_marks, es.exam_id FROM exam_subjects es
     JOIN examinations ex ON ex.id = es.exam_id
     JOIN teacher_assignments ta ON ta.class_id = ex.class_id AND ta.subject_id = es.subject_id
     JOIN teachers t ON t.id = ta.teacher_id
     WHERE t.first_name = 'Amit' LIMIT 1`
  );

  // Find an exam subject NOT taught by Amit
  const [[otherExamSub]] = await pool.execute(
    `SELECT es.id FROM exam_subjects es
     WHERE es.id NOT IN (
       SELECT es2.id FROM exam_subjects es2
       JOIN examinations ex ON ex.id = es2.exam_id
       JOIN teacher_assignments ta ON ta.class_id = ex.class_id AND ta.subject_id = es2.subject_id
       JOIN teachers t ON t.id = ta.teacher_id
       WHERE t.first_name = 'Amit'
     ) LIMIT 1`
  );

  if (otherExamSub) {
    const resForbiddenResult = await request("POST", "/results", {
      token: teacherToken,
      body: {
        student_id: sampleStudent.id,
        exam_subject_id: otherExamSub.id,
        marks_obtained: 85,
      },
    });
    assert(
      "Teacher cannot enter result for unassigned class/subject (403)",
      resForbiddenResult.status === 403
    );
  }

  // Teacher cannot modify marks when grading window is closed
  const [[sampleResult]] = await pool.execute(
    `SELECT r.id, r.marks_obtained, r.grade FROM results r
     JOIN exam_subjects es ON es.id = r.exam_subject_id
     JOIN examinations ex ON ex.id = es.exam_id
     JOIN teacher_assignments ta ON ta.class_id = ex.class_id AND ta.subject_id = es.subject_id
     JOIN teachers t ON t.id = ta.teacher_id
     WHERE t.first_name = 'Amit' LIMIT 1`
  );
  const resLockedEdit = await request("PATCH", `/results/${sampleResult.id}`, {
    token: teacherToken,
    body: { marks_obtained: 95 },
  });
  assert(
    "Teacher cannot edit marks when grading window is closed (403)",
    resLockedEdit.status === 403
  );
  assert(
    "Message informs teacher to submit a Correction Request",
    resLockedEdit.body?.message?.includes("Correction Request")
  );

  // Teacher submits Result Correction Request
  const resResultCorrection = await request("POST", "/correction-requests", {
    token: teacherToken,
    body: {
      request_type: "result",
      target_id: sampleResult.id,
      proposed_changes: { marks_obtained: 96, remarks: "Re-evaluation mark correction" },
      reason: "Re-evaluation completed. Student's question #4 had clerical error.",
    },
  });
  assert("Teacher submits result correction request → 201", resResultCorrection.status === 201);
  const createdResReqId = resResultCorrection.body?.data?.id;

  // Admin approves Result Correction Request
  const resApproveResult = await request("PATCH", `/correction-requests/${createdResReqId}/review`, {
    token: adminToken,
    body: { status: "approved", admin_notes: "Re-evaluation confirmed by Department Chair." },
  });
  assert("Admin approves result correction request → 200", resApproveResult.status === 200);

  // Check updated result
  const [[verifiedResult]] = await pool.execute("SELECT marks_obtained, grade, result_status FROM results WHERE id = ?", [
    sampleResult.id,
  ]);
  assert("Result marks updated to 96", Number(verifiedResult.marks_obtained) === 96);
  assert("Grade auto-recalculated to A+", verifiedResult.grade === "A+");

  // Restore sample result to original
  await pool.execute("UPDATE results SET marks_obtained = ?, grade = ? WHERE id = ?", [
    sampleResult.marks_obtained,
    sampleResult.grade,
    sampleResult.id,
  ]);

  // Restore student attendance if changed
  await pool.execute("UPDATE attendance SET status = 'present' WHERE attendance_session_id = ? AND student_id = ?", [
    sampleSession.id,
    sampleStudent.id,
  ]);

  // Clean test correction requests
  if (createdAttRequestId) {
    await pool.execute("DELETE FROM correction_requests WHERE id = ?", [createdAttRequestId]);
  }
  if (createdResReqId) {
    await pool.execute("DELETE FROM correction_requests WHERE id = ?", [createdResReqId]);
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════════════════════\n");

  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
