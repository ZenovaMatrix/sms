"use strict";

const http = require("http");

const pool = require("../src/config/db");

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
          resolve({ status: res.statusCode, body: body });
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

async function runTests() {
  console.log("====================================");
  console.log("EduManage Users API Test Suite");
  console.log("====================================\n");

  try {
    // 1. Health
    const health = await request({ path: "/api/v1/health", method: "GET" });
    console.log("1. GET /api/v1/health:", health.status, health.body.data);

    // 2. GET All Users
    const allUsers = await request({ path: "/api/v1/users", method: "GET" });
    console.log("2. GET /api/v1/users:", allUsers.status, "| Total users:", allUsers.body.data.pagination.total, "| Returned:", allUsers.body.data.users.length);

    // Check password_hash exposure
    const hasPasswordHash = JSON.stringify(allUsers.body).includes("password_hash");
    console.log("   password_hash exposed?:", hasPasswordHash ? "FAIL" : "PASSED (Safe)");

    // 3. Pagination
    const pageUsers = await request({ path: "/api/v1/users?page=1&limit=5", method: "GET" });
    console.log("3. GET /api/v1/users?page=1&limit=5:", pageUsers.status, "| Page:", pageUsers.body.data.pagination.page, "| Limit:", pageUsers.body.data.pagination.limit, "| TotalPages:", pageUsers.body.data.pagination.totalPages);

    // 4. Role filter (teacher)
    const teacherUsers = await request({ path: "/api/v1/users?role=teacher", method: "GET" });
    console.log("4. GET /api/v1/users?role=teacher:", teacherUsers.status, "| Matching count:", teacherUsers.body.data.pagination.total);

    // 5. Status filter (active)
    const activeUsers = await request({ path: "/api/v1/users?status=active", method: "GET" });
    console.log("5. GET /api/v1/users?status=active:", activeUsers.status, "| Matching count:", activeUsers.body.data.pagination.total);

    // 6. Search (Amit)
    const searchUsers = await request({ path: "/api/v1/users?search=Amit", method: "GET" });
    console.log("6. GET /api/v1/users?search=Amit:", searchUsers.status, "| User name found:", searchUsers.body.data.users[0]?.name);

    // 7. GET User by ID
    const firstId = allUsers.body.data.users[0].id;
    const userById = await request({ path: `/api/v1/users/${firstId}`, method: "GET" });
    console.log("7. GET /api/v1/users/:id:", userById.status, "| User found:", userById.body.data.name);

    // 8. GET User by Email
    const firstEmail = allUsers.body.data.users[0].email;
    const userByEmail = await request({ path: `/api/v1/users/email/${firstEmail}`, method: "GET" });
    console.log("8. GET /api/v1/users/email/:email:", userByEmail.status, "| User found:", userByEmail.body.data.email);

    // 9. GET User by Non-existing ID (404 test)
    const invalidId = await request({ path: "/api/v1/users/00000000-0000-0000-0000-000000000000", method: "GET" });
    console.log("9. GET /api/v1/users/<invalid-id>:", invalidId.status, "| Message:", invalidId.body.message);

    // 10. POST Users (501 test)
    const postResult = await request({ path: "/api/v1/users", method: "POST", headers: { "Content-Type": "application/json" } }, { name: "Test" });
    console.log("10. POST /api/v1/users:", postResult.status, "| Message:", postResult.body.message);

    // 11. DELETE Users (501 test)
    const deleteResult = await request({ path: `/api/v1/users/${firstId}`, method: "DELETE" });
    console.log("11. DELETE /api/v1/users/:id:", deleteResult.status, "| Message:", deleteResult.body.message);

    // 12. PATCH Safe field (phone update) with pre-test capture and restoration
    const targetId = "10000000-0000-0000-0000-000000000002"; // Amit Verma

    // Capture BOTH phone and updated_at before PATCH
    const [preTestRows] = await pool.query("SELECT phone, updated_at FROM users WHERE id = ?", [targetId]);
    const preTestPhone = preTestRows[0].phone;
    const preTestUpdatedAt = preTestRows[0].updated_at;
    console.log("12. PATCH /api/v1/users/:id test:");
    console.log("    Pre-test values in DB  -> phone:", preTestPhone, "| updated_at:", preTestUpdatedAt.toISOString());

    // Perform PATCH via API
    const patchResult = await request(
      { path: `/api/v1/users/${targetId}`, method: "PATCH", headers: { "Content-Type": "application/json" } },
      { phone: "9876599999" }
    );
    console.log("    PATCH response status  :", patchResult.status, "| Returned phone:", patchResult.body.data?.phone);

    // Check post-PATCH values in MySQL
    const [duringRows] = await pool.query("SELECT phone, updated_at FROM users WHERE id = ?", [targetId]);
    console.log("    Post-PATCH values in DB -> phone:", duringRows[0].phone, "| updated_at:", duringRows[0].updated_at.toISOString());

    // 13. PATCH Forbidden field attempt (password_hash)
    const patchForbidden = await request(
      { path: `/api/v1/users/${targetId}`, method: "PATCH", headers: { "Content-Type": "application/json" } },
      { password_hash: "hacked" }
    );
    console.log("13. PATCH forbidden field attempt:", patchForbidden.status, "| Message:", patchForbidden.body.message);

    // Restore BOTH original values in MySQL
    await pool.query("UPDATE users SET phone = ?, updated_at = ? WHERE id = ?", [preTestPhone, preTestUpdatedAt, targetId]);

    // Query MySQL after restoration
    const [postRestoreRows] = await pool.query("SELECT phone, updated_at FROM users WHERE id = ?", [targetId]);
    const postRestorePhone = postRestoreRows[0].phone;
    const postRestoreUpdatedAt = postRestoreRows[0].updated_at;
    console.log("    Restored values in DB   -> phone:", postRestorePhone, "| updated_at:", postRestoreUpdatedAt.toISOString());

    // Verify both are identical to pre-test values
    const isPhoneIdentical = postRestorePhone === preTestPhone;
    const isUpdatedAtIdentical = postRestoreUpdatedAt.getTime() === preTestUpdatedAt.getTime();

    console.log("    Verification -> phone restored identical?     :", isPhoneIdentical ? "PASSED (Identical)" : "FAILED");
    console.log("    Verification -> updated_at restored identical?:", isUpdatedAtIdentical ? "PASSED (Identical)" : "FAILED");

    // Final database integrity check
    const [finalCountRows] = await pool.query("SELECT COUNT(*) AS total FROM users;");
    console.log("\n14. Final Database Integrity Check: Total users =", finalCountRows[0].total);
    console.log("    Count matches expected 22?                   :", finalCountRows[0].total === 22 ? "PASSED" : "FAILED");

    console.log("\n====================================");
    console.log("TEST SUITE COMPLETE");
    console.log("====================================");
  } finally {
    await pool.end();
  }
}

runTests().catch((err) => console.error("TEST FAILED:", err));
