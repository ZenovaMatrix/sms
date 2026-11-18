"use strict";

const pool = require("../src/config/db");

async function migrate() {
  try {
    console.log("Ensuring admin_otp table in TiDB Cloud...");
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS admin_otp (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        email VARCHAR(150) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_otp_user (user_id),
        INDEX idx_otp_email (email),
        INDEX idx_otp_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    await pool.execute(createTableSql);
    console.log("admin_otp table verified successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
