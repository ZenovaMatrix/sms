"use strict";

const https = require("https");

function post(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log("=== Testing All Role Logins on LIVE Vercel Deployment ===");

  const cases = [
    { email: "iamayush522@gmail.com", password: "Password@123", selectedRole: "admin", label: "Admin (Ayush)" },
    { email: "admin@edumanage.com", password: "Password@123", selectedRole: "admin", label: "Admin" },
    { email: "demo@edumanage.com", password: "Demo@EduManage2026", selectedRole: "admin", label: "Demo Admin" },
    { email: "amit@edumanage.com", password: "Password@123", selectedRole: "faculty", label: "Faculty / Teacher" },
    { email: "aarav@edumanage.com", password: "Password@123", selectedRole: "student", label: "Student" },
    { email: "sunita@edumanage.com", password: "Password@123", selectedRole: "parent", label: "Parent" },
    { email: "mohan@edumanage.com", password: "Password@123", selectedRole: "librarian", label: "Librarian" },
  ];

  for (const c of cases) {
    const res = await post("https://edumanage-teal.vercel.app/api/v1/auth/login", {
      email: c.email,
      password: c.password,
      selectedRole: c.selectedRole,
    });
    console.log(`[${res.status === 200 ? 'PASS' : 'FAIL'}] ${c.label} (${c.email}) -> Status: ${res.status}`);
    if (res.status !== 200) {
      console.log("  Details:", JSON.stringify(res.data || res.raw));
    } else {
      console.log("  Data:", res.data.message, res.data.data.requiresOtp ? "(2FA required)" : `(Token role: ${res.data.data.user.role})`);
    }
  }
}

run().catch(console.error);
