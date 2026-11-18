"use strict";

const mysql = require("mysql2/promise");
const config = require("./env");

/**
 * db.js
 *
 * Creates and exports a reusable MySQL connection pool.
 * All database operations across the app must use this pool
 * rather than creating new connections per request.
 */

const poolConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  waitForConnections: true,
  queueLimit: 0,
  timezone: "Z",
};

if (config.db.ssl) {
  poolConfig.ssl = config.db.ssl;
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
