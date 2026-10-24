"use strict";

const pool = require("../../config/db");

async function findPolicyByType(policyType) {
  const [rows] = await pool.execute(
    "SELECT * FROM portal_deadlines WHERE policy_type = ?",
    [policyType]
  );
  return rows[0] || null;
}

async function getAllPolicies() {
  const [rows] = await pool.execute(
    "SELECT * FROM portal_deadlines ORDER BY policy_type ASC"
  );
  return rows;
}

async function updatePolicy(policyType, fields) {
  const sets = [];
  const params = [];

  for (const [key, value] of Object.entries(fields)) {
    if (["daily_deadline_time", "past_days_allowed", "grading_window_days", "timezone", "is_strict"].includes(key)) {
      sets.push(`\`${key}\` = ?`);
      params.push(value);
    }
  }

  if (sets.length === 0) return findPolicyByType(policyType);

  params.push(policyType);
  await pool.execute(
    `UPDATE portal_deadlines SET ${sets.join(", ")} WHERE policy_type = ?`,
    params
  );

  return findPolicyByType(policyType);
}

module.exports = {
  findPolicyByType,
  getAllPolicies,
  updatePolicy,
};
