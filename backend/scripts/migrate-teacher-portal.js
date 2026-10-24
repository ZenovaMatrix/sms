const mysql = require("mysql2/promise");
require("dotenv").config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "school_erp",
    port: process.env.DB_PORT || 3306,
  });

  console.log("Connected to MySQL database...");

  // 1. portal_deadlines table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS portal_deadlines (
      id CHAR(36) PRIMARY KEY,
      policy_type VARCHAR(50) NOT NULL UNIQUE,
      daily_deadline_time TIME NULL DEFAULT '14:00:00',
      past_days_allowed INT DEFAULT 0,
      grading_window_days INT DEFAULT 7,
      timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
      is_strict TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log("Verified/Created portal_deadlines table");

  // Seed default deadlines if not exists
  const [existingDeadlines] = await connection.execute("SELECT policy_type FROM portal_deadlines");
  const types = existingDeadlines.map((r) => r.policy_type);

  if (!types.includes("attendance")) {
    await connection.execute(
      `INSERT INTO portal_deadlines (id, policy_type, daily_deadline_time, past_days_allowed, timezone, is_strict)
       VALUES (UUID(), 'attendance', '14:00:00', 0, 'Asia/Kolkata', 1)`
    );
    console.log("Seeded default attendance deadline policy");
  }

  if (!types.includes("grading")) {
    await connection.execute(
      `INSERT INTO portal_deadlines (id, policy_type, grading_window_days, timezone, is_strict)
       VALUES (UUID(), 'grading', 14, 'Asia/Kolkata', 1)`
    );
    console.log("Seeded default grading deadline policy");
  }

  // 2. correction_requests table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS correction_requests (
      id CHAR(36) PRIMARY KEY,
      request_type ENUM('attendance', 'result') NOT NULL,
      teacher_id CHAR(36) NOT NULL,
      class_id CHAR(36) NULL,
      section_id CHAR(36) NULL,
      subject_id CHAR(36) NULL,
      target_id CHAR(36) NULL,
      target_date DATE NULL,
      proposed_changes JSON NOT NULL,
      current_data JSON NULL,
      reason TEXT NOT NULL,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      admin_notes TEXT NULL,
      reviewed_by CHAR(36) NULL,
      reviewed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cr_teacher (teacher_id),
      INDEX idx_cr_status (status),
      INDEX idx_cr_type (request_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log("Verified/Created correction_requests table");

  // 3. audit_logs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id CHAR(36) PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id CHAR(36) NULL,
      action VARCHAR(50) NOT NULL,
      user_id CHAR(36) NOT NULL,
      user_role VARCHAR(20) NOT NULL,
      user_name VARCHAR(100) NULL,
      old_values JSON NULL,
      new_values JSON NULL,
      reason TEXT NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_entity (entity_type, entity_id),
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
  console.log("Verified/Created audit_logs table");

  await connection.end();
  console.log("Teacher Portal migration completed successfully.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
