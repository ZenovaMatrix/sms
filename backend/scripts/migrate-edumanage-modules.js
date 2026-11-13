"use strict";

const pool = require("../src/config/db");

async function run() {
  try {
    console.log("Starting migration for EduManage modules...");

    // 1. Add status column to classes if missing
    const [cols1] = await pool.query("SHOW COLUMNS FROM `classes` LIKE 'status'");
    if (cols1.length === 0) {
      await pool.query("ALTER TABLE `classes` ADD COLUMN `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active'");
      console.log("✔ Added status column to classes");
    } else {
      console.log("ℹ classes.status already exists");
    }

    // 2. Add status column to sections if missing
    const [cols2] = await pool.query("SHOW COLUMNS FROM `sections` LIKE 'status'");
    if (cols2.length === 0) {
      await pool.query("ALTER TABLE `sections` ADD COLUMN `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active'");
      console.log("✔ Added status column to sections");
    } else {
      console.log("ℹ sections.status already exists");
    }

    // 3. Create substitute_assignments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`substitute_assignments\` (
        \`id\` CHAR(36) NOT NULL,
        \`original_teacher_id\` CHAR(36) NOT NULL,
        \`substitute_teacher_id\` CHAR(36) NOT NULL,
        \`class_id\` CHAR(36) NOT NULL,
        \`section_id\` CHAR(36) NOT NULL,
        \`subject_id\` CHAR(36) NOT NULL,
        \`academic_year_id\` CHAR(36) DEFAULT NULL,
        \`start_date\` DATE NOT NULL,
        \`end_date\` DATE NOT NULL,
        \`reason\` VARCHAR(255) DEFAULT NULL,
        \`status\` ENUM('assigned', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'assigned',
        \`notes\` TEXT DEFAULT NULL,
        \`created_by\` CHAR(36) NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_sub_orig\` (\`original_teacher_id\`),
        KEY \`idx_sub_subst\` (\`substitute_teacher_id\`),
        KEY \`idx_sub_class\` (\`class_id\`),
        KEY \`idx_sub_dates\` (\`start_date\`, \`end_date\`),
        CONSTRAINT \`fk_sub_orig\` FOREIGN KEY (\`original_teacher_id\`) REFERENCES \`teachers\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_sub_subst\` FOREIGN KEY (\`substitute_teacher_id\`) REFERENCES \`teachers\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_sub_class\` FOREIGN KEY (\`class_id\`) REFERENCES \`classes\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_sub_section\` FOREIGN KEY (\`section_id\`) REFERENCES \`sections\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_sub_subject\` FOREIGN KEY (\`subject_id\`) REFERENCES \`subjects\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_sub_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log("✔ Created substitute_assignments table");

    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();

