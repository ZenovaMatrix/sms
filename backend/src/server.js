"use strict";

/**
 * server.js
 *
 * Entry point for the EduManage backend server.
 *
 * Responsibilities:
 *   1. Load and validate configuration via env.js
 *   2. Start the Express HTTP server
 *   3. Log server URL and environment
 */

const config = require("./config/env");
const app = require("./app");

const PORT = config.port;
const DIVIDER = "====================================";

app.listen(PORT, () => {
  console.log(DIVIDER);
  console.log("EduManage Backend");
  console.log(DIVIDER);
  console.log();
  console.log(`Server running on:`);
  console.log(`http://localhost:${PORT}`);
  console.log();
  console.log(`Environment:`);
  console.log(`${process.env.NODE_ENV || "development"}`);
  console.log(DIVIDER);
});
