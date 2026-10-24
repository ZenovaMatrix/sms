"use strict";

require("dotenv").config();

/**
 * env.js
 *
 * Loads and validates all required environment variables.
 * Exports a frozen configuration object for use across the app.
 * Fails fast with a clear error if required DB config is missing.
 */

const _required = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
];

const _missing = _required.filter((key) => {
  const val = process.env[key];
  return val === undefined || val === null || val.trim() === "";
});

if (_missing.length > 0) {
  console.error(
    `[Config Error] Missing required environment variable(s): ${_missing.join(", ")}`
  );
  console.error(
    "Please check your .env file and ensure all required variables are set."
  );
  process.exit(1);
}

const config = Object.freeze({
  port: parseInt(process.env.PORT, 10) || 5000,

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    // Password is read directly — never logged or exposed
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },

  jwt: {
    // Secret is read directly — never logged or exposed
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },
});

module.exports = config;
