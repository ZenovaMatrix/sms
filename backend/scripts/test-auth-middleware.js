/**
 * test-auth-middleware.js
 *
 * Phase 3C Integration Test — JWT Authentication Middleware + RBAC
 *
 * Tests performed:
 *   1.  POST /login (admin)          — obtain admin JWT
 *   2.  POST /login (teacher)        — obtain teacher JWT
 *   3.  POST /login (librarian)      — obtain librarian JWT
 *   4.  GET /me (admin JWT)          — 200, userId + role returned
 *   5.  GET /me (no token)           — 401 Authentication token required
 *   6.  GET /me (bad token)          — 401 Invalid or expired token
 *   7.  GET /test/admin (admin)      — 200 allowed
 *   8.  GET /test/admin (teacher)    — 403 forbidden
 *   9.  GET /test/admin (librarian)  — 403 forbidden
 *   10. GET /test/teacher (teacher)  — 200 allowed
 *   11. GET /test/teacher (admin)    — 403 forbidden
 *   12. GET /test/librarian (lib)    — 200 allowed
 *   13. GET /test/librarian (admin)  — 200 allowed (admin+librarian route)
 *   14. GET /test/librarian (teacher)— 403 forbidden
 *
 * Usage: node scripts/test-auth-middleware.js
 * Requires server to be running on PORT from .env (default 5000).
 *
 * Test credentials (set via set-test-password.js):
 *   admin@edumanage.com   / Password@123  (role: admin)
 *   amit@edumanage.com    / Password@123  (role: teacher)
 *   mohan@edumanage.com   / Password@123  (role: librarian)
 */

"use strict";

require("dotenv").config();
const http = require("http");

const PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${PORT}/api/v1`;

// ─── helpers ────────────────────────────────────────────────────────────────

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

// ─── test runner ─────────────────────────────────────────────────────────────

async function run() {
  console.log("\n══════════════════════════════════════════════");
  console.log("  Phase 3C — JWT Middleware + RBAC Test Suite");
  console.log(`  Target: ${BASE}`);
  console.log("══════════════════════════════════════════════\n");

  // ── Step 1: Obtain tokens by logging in ──────────────────────────────────

  console.log("── Step 1: Obtain Tokens ──────────────────────");

  let adminToken, teacherToken, librarianToken;

  {
    const r = await request("POST", "/auth/login", {
      body: { email: "admin@edumanage.com", password: "Password@123" },
    });
    assert(
      "POST /auth/login (admin) → 200",
      r.status === 200 && r.body.success === true,
      `status=${r.status} msg=${r.body?.message}`
    );
    adminToken = r.body?.data?.token;
    assert("Admin JWT received", !!adminToken, "no token in response");
    console.log(`     Admin role in response: ${r.body?.data?.user?.role}`);
  }

  {
    const r = await request("POST", "/auth/login", {
      body: { email: "amit@edumanage.com", password: "Password@123" },
    });
    assert(
      "POST /auth/login (teacher) → 200",
      r.status === 200 && r.body.success === true,
      `status=${r.status} msg=${r.body?.message}`
    );
    teacherToken = r.body?.data?.token;
    assert("Teacher JWT received", !!teacherToken, "no token in response");
    console.log(`     Teacher role in response: ${r.body?.data?.user?.role}`);
  }

  {
    const r = await request("POST", "/auth/login", {
      body: { email: "mohan@edumanage.com", password: "Password@123" },
    });
    assert(
      "POST /auth/login (librarian) → 200",
      r.status === 200 && r.body.success === true,
      `status=${r.status} msg=${r.body?.message}`
    );
    librarianToken = r.body?.data?.token;
    assert("Librarian JWT received", !!librarianToken, "no token in response");
    console.log(`     Librarian role in response: ${r.body?.data?.user?.role}`);
  }

  // ── Step 2: GET /me ───────────────────────────────────────────────────────

  console.log("\n── Step 2: GET /auth/me ───────────────────────");

  {
    const r = await request("GET", "/auth/me", { token: adminToken });
    assert(
      "GET /auth/me (admin JWT) → 200",
      r.status === 200 && r.body.success === true,
      `status=${r.status}`
    );
    assert(
      "GET /auth/me returns userId",
      !!r.body?.data?.userId,
      JSON.stringify(r.body?.data)
    );
    assert(
      "GET /auth/me returns role=admin",
      r.body?.data?.role === "admin",
      `role=${r.body?.data?.role}`
    );
  }

  {
    const r = await request("GET", "/auth/me"); // no token
    assert(
      "GET /auth/me (no token) → 401",
      r.status === 401,
      `status=${r.status}`
    );
    assert(
      "GET /auth/me (no token) returns success=false",
      r.body?.success === false,
      JSON.stringify(r.body)
    );
  }

  {
    const r = await request("GET", "/auth/me", { token: "invalid.token.here" });
    assert(
      "GET /auth/me (malformed token) → 401",
      r.status === 401,
      `status=${r.status}`
    );
    assert(
      "GET /auth/me (malformed token) success=false",
      r.body?.success === false,
      JSON.stringify(r.body)
    );
  }

  // ── Step 3: RBAC — /test/admin ───────────────────────────────────────────

  console.log("\n── Step 3: RBAC — /auth/test/admin ───────────");

  {
    const r = await request("GET", "/auth/test/admin", { token: adminToken });
    assert(
      "GET /test/admin (admin JWT) → 200",
      r.status === 200 && r.body.success === true,
      `status=${r.status}`
    );
  }

  {
    const r = await request("GET", "/auth/test/admin", { token: teacherToken });
    assert(
      "GET /test/admin (teacher JWT) → 403",
      r.status === 403 && r.body.success === false,
      `status=${r.status}`
    );
  }

  {
    const r = await request("GET", "/auth/test/admin", { token: librarianToken });
    assert(
      "GET /test/admin (librarian JWT) → 403",
      r.status === 403 && r.body.success === false,
      `status=${r.status}`
    );
  }

  // ── Step 4: RBAC — /test/teacher ─────────────────────────────────────────

  console.log("\n── Step 4: RBAC — /auth/test/teacher ─────────");

  {
    const r = await request("GET", "/auth/test/teacher", { token: teacherToken });
    assert(
      "GET /test/teacher (teacher JWT) → 200",
      r.status === 200 && r.body.success === true,
      `status=${r.status}`
    );
  }

  {
    const r = await request("GET", "/auth/test/teacher", { token: adminToken });
    assert(
      "GET /test/teacher (admin JWT) → 403",
      r.status === 403 && r.body.success === false,
      `status=${r.status}`
    );
  }

  // ── Step 5: RBAC — /test/librarian ───────────────────────────────────────

  console.log("\n── Step 5: RBAC — /auth/test/librarian ───────");

  {
    const r = await request("GET", "/auth/test/librarian", { token: librarianToken });
    assert(
      "GET /test/librarian (librarian JWT) → 200",
      r.status === 200 && r.body.success === true,
      `status=${r.status}`
    );
  }

  {
    const r = await request("GET", "/auth/test/librarian", { token: adminToken });
    assert(
      "GET /test/librarian (admin JWT) → 200 (admin+librarian route)",
      r.status === 200 && r.body.success === true,
      `status=${r.status}`
    );
  }

  {
    const r = await request("GET", "/auth/test/librarian", { token: teacherToken });
    assert(
      "GET /test/librarian (teacher JWT) → 403",
      r.status === 403 && r.body.success === false,
      `status=${r.status}`
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const total = passed + failed;
  console.log("\n══════════════════════════════════════════════");
  console.log(`  RESULTS: ${passed}/${total} tests passed`);
  if (failed === 0) {
    console.log("  ✅ Phase 3C — ALL TESTS PASSED");
  } else {
    console.log(`  ❌ Phase 3C — ${failed} TEST(S) FAILED`);
  }
  console.log("══════════════════════════════════════════════\n");

  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
