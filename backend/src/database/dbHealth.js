"use strict";

const pool = require("../config/db");
const config = require("../config/env");

/**
 * dbHealth.js
 *
 * Provides a health-check function that:
 *   1. Acquires a connection from the pool
 *   2. Runs SELECT 1 to verify basic connectivity
 *   3. Runs SELECT DATABASE() to confirm the active database
 *   4. Validates that the active database matches the configured DB_NAME
 *   5. Releases the connection back to the pool
 *
 * Returns: { connected: true, database: "edumanage" }
 * Throws:  Error with a diagnostic message on failure
 */

async function checkDatabaseConnection() {
  let connection;

  try {
    // Step 1: Acquire a connection from the pool
    connection = await pool.getConnection();

    // Step 2: Basic connectivity check
    const [pingRows] = await connection.execute("SELECT 1 AS connected");
    const pingResult = pingRows[0]?.connected;

    if (pingResult !== 1) {
      throw new Error("SELECT 1 did not return expected value.");
    }

    // Step 3: Confirm which database is active
    const [dbRows] = await connection.execute(
      "SELECT DATABASE() AS database_name"
    );
    const activeDatabase = dbRows[0]?.database_name;

    // Step 4: Validate against configured DB_NAME
    if (activeDatabase !== config.db.name) {
      throw new Error(
        `Database mismatch: expected "${config.db.name}", got "${activeDatabase}".`
      );
    }

    return {
      connected: true,
      database: activeDatabase,
    };
  } finally {
    // Step 5: Always release connection back to pool
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { checkDatabaseConnection };
