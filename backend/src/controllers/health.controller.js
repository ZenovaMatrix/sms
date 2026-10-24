"use strict";

const { checkDatabaseConnection } = require("../database/dbHealth");

/**
 * health.controller.js
 *
 * Controller for health check endpoint.
 * Leverages existing dbHealth module to check database connectivity.
 */
async function getHealth(req, res) {
  try {
    const dbResult = await checkDatabaseConnection();

    return res.status(200).json({
      success: true,
      message: "EduManage API is healthy",
      data: {
        api: "ok",
        database: dbResult.connected ? "connected" : "disconnected",
        databaseName: dbResult.database,
      },
    });
  } catch (error) {
    // Log error internally without exposing credentials in response
    console.error("[Health Check Error]:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database connection unavailable",
      data: null,
    });
  }
}

module.exports = {
  getHealth,
};
