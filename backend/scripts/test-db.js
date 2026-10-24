"use strict";

/**
 * scripts/test-db.js
 *
 * Standalone database connection test script.
 *
 * Usage:
 *   npm run test:db
 *
 * This script:
 *   1. Loads environment variables
 *   2. Imports the MySQL connection pool
 *   3. Runs the database health check
 *   4. Prints a clear pass/fail result
 *   5. Closes the pool cleanly
 *
 * It is completely independent of the Express server.
 * Run this to verify DB credentials and connectivity
 * before starting the application.
 *
 * SECURITY: The DB password is NEVER printed.
 */

// Must be the first thing — loads and validates all env vars
const config = require("../src/config/env");
const pool = require("../src/config/db");
const { checkDatabaseConnection } = require("../src/database/dbHealth");

const DIVIDER = "====================================";

async function runTest() {
  console.log(DIVIDER);
  console.log("  EduManage Database Connection Test");
  console.log(DIVIDER);
  console.log();
  console.log(`  Host     : ${config.db.host}`);
  console.log(`  Port     : ${config.db.port}`);
  console.log(`  User     : ${config.db.user}`);
  // Password intentionally omitted
  console.log(`  Database : ${config.db.name}`);
  console.log();
  console.log("  Testing connection...");
  console.log();

  try {
    const result = await checkDatabaseConnection();

    console.log("  ✔  Database connection successful.");
    console.log();
    console.log(`  Connected Database : ${result.database}`);
    console.log(`  SELECT 1 test      : PASSED`);
    console.log();
    console.log(DIVIDER);
    console.log("  DATABASE CONNECTION: SUCCESS");
    console.log(DIVIDER);
    console.log();
  } catch (err) {
    console.error("  ✖  Connection attempt failed.");
    console.error();

    // Provide a helpful diagnostic without leaking secrets
    let reason = "Unknown error";

    if (err.code === "ER_ACCESS_DENIED_ERROR") {
      reason = "Access denied — check DB_USER and DB_PASSWORD in your .env";
    } else if (err.code === "ECONNREFUSED") {
      reason =
        "Connection refused — MySQL server may not be running on " +
        `${config.db.host}:${config.db.port}`;
    } else if (err.code === "ER_BAD_DB_ERROR") {
      reason = `Unknown database "${config.db.name}" — verify the DB_NAME in your .env`;
    } else if (err.code === "ETIMEDOUT" || err.code === "ECONNRESET") {
      reason = "Connection timed out — check host, port, and network settings";
    } else if (err.message) {
      reason = err.message;
    }

    console.error(`  Reason: ${reason}`);
    console.error();
    console.error(DIVIDER);
    console.error("  DATABASE CONNECTION: FAILED");
    console.error(DIVIDER);
    console.error();

    process.exitCode = 1;
  } finally {
    // Always close the pool cleanly so the process can exit
    await pool.end();
  }
}

runTest();
