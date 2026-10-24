"use strict";

const auditRepo = require("./audit.repository");

async function getLogs(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const entity_type = req.query.entity_type || null;
    const entity_id = req.query.entity_id || null;
    const user_id = req.query.user_id || null;

    const data = await auditRepo.getAuditLogs({ entity_type, entity_id, user_id, page, limit });
    res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully.",
      data,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLogs,
};
