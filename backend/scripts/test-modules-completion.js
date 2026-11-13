"use strict";

const http = require("http");
const pool = require("../src/config/db");
const { generateToken } = require("../src/utils/jwt");

const PORT = process.env.PORT || 5000;

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

async function run() {
  console.log("══════════════════════════════════════════════════════");
  console.log("  EduManage Comprehensive Verification Test Suite");
  console.log("══════════════════════════════════════════════════════\n");

  // Step 1: Acquire Tokens
  const [[adminUser]] = await pool.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const adminToken = generateToken({ userId: adminUser.id, role: "admin", email: "admin@edumanage.com" });
  assert("Admin token generated", !!adminToken);

  const [[teacher1]] = await pool.execute("SELECT id, first_name, last_name FROM teachers LIMIT 1");
  const [[teacher2]] = await pool.execute("SELECT id, first_name, last_name FROM teachers WHERE id != ? LIMIT 1", [teacher1.id]);
  const [[cls]] = await pool.execute("SELECT id, class_name FROM classes LIMIT 1");
  const [[sec]] = await pool.execute("SELECT id, section_name FROM sections WHERE class_id = ? LIMIT 1", [cls.id]);
  const [[sub]] = await pool.execute("SELECT id, subject_name FROM subjects LIMIT 1");
  const [[ay]] = await pool.execute("SELECT id FROM academic_years WHERE status = 'active' LIMIT 1");

  // ─────────────────────────────────────────────────────────────
  // 1. Substitute Teacher Management
  // ─────────────────────────────────────────────────────────────
  console.log("\n── Module 1: Substitute Teacher Management ────────────");
  const rRec = await request("GET", `/substitutes/recommendations?teacher_id=${teacher1.id}&class_id=${cls.id}&section_id=${sec.id}&subject_id=${sub.id}&date=2026-11-15`, {
    token: adminToken,
  });
  assert("GET /substitutes/recommendations → 200", rRec.status === 200);
  assert("Returns ranked recommendations array", Array.isArray(rRec.body?.data?.recommendations));
  assert("Each recommendation has score & explanation", rRec.body?.data?.recommendations?.length > 0 && !!rRec.body.data.recommendations[0].explanation);

  // Assign substitute
  const subPayload = {
    original_teacher_id: teacher1.id,
    substitute_teacher_id: teacher2.id,
    class_id: cls.id,
    section_id: sec.id,
    subject_id: sub.id,
    start_date: "2026-11-15",
    end_date: "2026-11-17",
    reason: "Medical Leave - Coverage required",
    notes: "AI-assisted recommendation confirmed by principal",
  };

  const rAssign = await request("POST", "/substitutes/assign", {
    token: adminToken,
    body: subPayload,
  });
  assert("POST /substitutes/assign → 201", rAssign.status === 201);
  const subId = rAssign.body?.data?.id;
  assert("Substitute assignment ID returned", !!subId);

  // Check audit log for substitution
  const rAuditSub = await request("GET", `/audit-logs?entity_type=substitute_assignment&entity_id=${subId}`, {
    token: adminToken,
  });
  assert("Audit log recorded for substitute assignment", rAuditSub.status === 200 && rAuditSub.body?.data?.logs?.length > 0);

  // Check announcement notification created
  const [[notif]] = await pool.execute(
    `SELECT id, title FROM announcements WHERE class_id = ? AND section_id = ? ORDER BY created_at DESC LIMIT 1`,
    [cls.id, sec.id]
  );
  assert("Notification announcement generated", !!notif && notif.title.includes("Substitute Teacher Assignment"));

  // Update substitute status
  const rSubStatus = await request("PATCH", `/substitutes/${subId}/status`, {
    token: adminToken,
    body: { status: "completed", notes: "Coverage completed successfully" },
  });
  assert("PATCH /substitutes/:id/status → 200", rSubStatus.status === 200);
  assert("Status updated to completed", rSubStatus.body?.data?.status === "completed");

  // Clean up substitute record and announcement for count preservation
  await pool.execute("DELETE FROM substitute_assignments WHERE id = ?", [subId]);
  await pool.execute("DELETE FROM announcements WHERE id = ?", [notif.id]);
  await pool.execute("DELETE FROM audit_logs WHERE entity_id = ?", [subId]);

  // ─────────────────────────────────────────────────────────────
  // 2. Faculty & Teachers
  // ─────────────────────────────────────────────────────────────
  console.log("\n── Module 2: Faculty & Teachers ───────────────────────");
  const [[dept]] = await pool.execute("SELECT id FROM departments LIMIT 1");
  const rTeacherEdit = await request("PATCH", `/teachers/${teacher1.id}`, {
    token: adminToken,
    body: {
      phone: "9876543210",
      department_id: dept.id,
      qualification: "M.Sc Mathematics, B.Ed",
      status: "active",
    },
  });
  assert("PATCH /teachers/:id with department_id → 200", rTeacherEdit.status === 200);
  assert("Teacher phone updated", rTeacherEdit.body?.data?.phone === "9876543210");
  assert("Teacher qualification updated", rTeacherEdit.body?.data?.qualification === "M.Sc Mathematics, B.Ed");

  // Safe delete with dependencies test
  const rTeacherDel = await request("DELETE", `/teachers/${teacher1.id}`, { token: adminToken });
  assert("DELETE /teachers/:id with assignments archives safely → 200", rTeacherDel.status === 200);
  assert("Response indicates archived = true", rTeacherDel.body?.data?.archived === true || rTeacherDel.body?.archived === true);

  // Restore teacher status to active
  await pool.execute("UPDATE teachers SET status = 'active' WHERE id = ?", [teacher1.id]);

  // ─────────────────────────────────────────────────────────────
  // 3. Classes & Sections
  // ─────────────────────────────────────────────────────────────
  console.log("\n── Module 3: Classes & Sections ───────────────────────");
  // Test class PATCH with status
  const rClassPatch = await request("PATCH", `/classes/${cls.id}`, {
    token: adminToken,
    body: { status: "active", description: "Updated grade description" },
  });
  assert("PATCH /classes/:id with status → 200", rClassPatch.status === 200);
  assert("Class status is active", rClassPatch.body?.data?.status === "active");

  // Test section PATCH with capacity and status
  const rSecPatch = await request("PATCH", `/sections/${sec.id}`, {
    token: adminToken,
    body: { status: "active", capacity: 40 },
  });
  assert("PATCH /sections/:id with status & capacity → 200", rSecPatch.status === 200);
  assert("Section capacity is 40", rSecPatch.body?.data?.capacity === 40);

  // Test class deletion dependency check
  const rClassDel = await request("DELETE", `/classes/${cls.id}`, { token: adminToken });
  assert("DELETE /classes/:id with dependents → 409", rClassDel.status === 409);
  assert("Error explains referenced dependencies", rClassDel.body?.message?.includes("referenced by"));

  // ─────────────────────────────────────────────────────────────
  // 4. Fee & Financial Management
  // ─────────────────────────────────────────────────────────────
  console.log("\n── Module 4: Fee & Financial Management ───────────────");
  // Create temporary fee structure
  const fsPayload = {
    academic_year_id: ay.id,
    class_id: cls.id,
    fee_type: "Test Lab Fee " + Date.now(),
    amount: 1500,
    due_date: "2026-12-15",
    description: "Annual Computer & Science Lab Fee",
  };
  const rFsCreate = await request("POST", "/fees/structures", {
    token: adminToken,
    body: fsPayload,
  });
  assert("POST /fees/structures → 201", rFsCreate.status === 201);
  const tempFsId = rFsCreate.body?.data?.id;

  // Bulk assign fee structure to class
  const rBulkAssign = await request("POST", "/fees/bulk-assign", {
    token: adminToken,
    body: {
      fee_structure_id: tempFsId,
      class_id: cls.id,
      amount_due: 1500,
    },
  });
  assert("POST /fees/bulk-assign → 201", rBulkAssign.status === 201);
  assert("Assigned count >= 0", rBulkAssign.body?.data?.assignedCount !== undefined);

  // Record a payment with partial payment
  const [[firstStudentFee]] = await pool.execute(
    "SELECT id, amount_due, balance FROM student_fees WHERE fee_structure_id = ? LIMIT 1",
    [tempFsId]
  );

  if (firstStudentFee) {
    const rPay = await request("POST", "/fees/payments", {
      token: adminToken,
      body: {
        student_fee_id: firstStudentFee.id,
        amount: 500,
        payment_method: "cash",
        payment_date: "2026-11-01",
      },
    });
    assert("POST /fees/payments partial payment → 201", rPay.status === 201);
    assert("Receipt number generated in response", !!rPay.body?.data?.receipt_number);

    // Verify balance reduced in student_fee
    const [[updatedSf]] = await pool.execute("SELECT amount_paid, balance, status FROM student_fees WHERE id = ?", [firstStudentFee.id]);
    assert("Partial payment amount_paid is ₹500", Number(updatedSf.amount_paid) === 500);
    assert("Balance reduced to ₹1000", Number(updatedSf.balance) === 1000);
    assert("Status updated to partial", updatedSf.status === "partial");

    // Clean up payment and student_fees
    await pool.execute("DELETE FROM payments WHERE student_fee_id = ?", [firstStudentFee.id]);
  }

  // Clean up created student_fees and fee_structure
  await pool.execute("DELETE FROM student_fees WHERE fee_structure_id = ?", [tempFsId]);
  await pool.execute("DELETE FROM fee_structures WHERE id = ?", [tempFsId]);
  await pool.execute("DELETE FROM audit_logs WHERE entity_id = ?", [tempFsId]);

  // ─────────────────────────────────────────────────────────────
  // 5. Permissions & Audit Trail
  // ─────────────────────────────────────────────────────────────
  console.log("\n── Module 5: Permissions and Audit Trail ──────────────");
  // Test user role update
  const [[testUser]] = await pool.execute("SELECT id, role FROM users WHERE role = 'librarian' LIMIT 1");
  if (testUser) {
    const rRole = await request("PATCH", `/users/${testUser.id}/role`, {
      token: adminToken,
      body: { role: "librarian", reason: "Verified permissions" },
    });
    assert("PATCH /users/:id/role with admin authorization → 200", rRole.status === 200);

    const rAuditRole = await request("GET", `/audit-logs?entity_type=user_permission&entity_id=${testUser.id}`, {
      token: adminToken,
    });
    assert("Audit log recorded for role update", rAuditRole.status === 200 && rAuditRole.body?.data?.logs?.length > 0);
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${passed + failed} tests passed`);
  if (failed === 0) {
    console.log("  ✅ ALL EduManage MODULE COMPLETION TESTS PASSED!");
  } else {
    console.log(`  ❌ ${failed} TEST(S) FAILED`);
  }
  console.log("══════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
