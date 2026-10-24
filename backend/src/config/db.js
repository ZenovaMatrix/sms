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

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
});

module.exports = pool;
