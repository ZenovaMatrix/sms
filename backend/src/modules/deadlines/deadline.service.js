"use strict";

const repo = require("./deadline.repository");
const auditRepo = require("../audit/audit.repository");

function getNowInTimezone(tz = "Asia/Kolkata") {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const dateStr = `${map.year}-${map.month}-${map.day}`;
    const timeStr = `${map.hour}:${map.minute}:${map.second}`;
    return { dateStr, timeStr, fullStr: `${dateStr} ${timeStr}` };
  } catch (err) {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toISOString().split("T")[1].substring(0, 8);
    return { dateStr, timeStr, fullStr: `${dateStr} ${timeStr}` };
  }
}

async function getPolicies() {
  const policies = await repo.getAllPolicies();
  return policies.map((p) => {
    const now = getNowInTimezone(p.timezone);
    return {
      ...p,
      current_server_time: now.timeStr,
      current_server_date: now.dateStr,
    };
  });
}

async function updatePolicy(policyType, data, requester) {
  const existing = await repo.findPolicyByType(policyType);
  if (!existing) {
    const err = new Error(`Deadline policy '${policyType}' not found.`);
    err.statusCode = 404;
    throw err;
  }

  const updated = await repo.updatePolicy(policyType, data);

  // Write audit log
  await auditRepo.createAuditLog({
    entity_type: "portal_deadlines",
    entity_id: existing.id,
    action: "UPDATE_POLICY",
    user_id: requester.userId,
    user_role: requester.role,
    user_name: requester.name || requester.email || "Admin",
    old_values: existing,
    new_values: updated,
    reason: `Updated ${policyType} deadline policy`,
  });

  return updated;
}

async function checkAttendanceWindow(sessionDateStr) {
  const policy = (await repo.findPolicyByType("attendance")) || {
    daily_deadline_time: "14:00:00",
    past_days_allowed: 0,
    timezone: "Asia/Kolkata",
    is_strict: 1,
  };

  const now = getNowInTimezone(policy.timezone);
  const sessionDate = new Date(`${sessionDateStr}T00:00:00`);
  const todayDate = new Date(`${now.dateStr}T00:00:00`);

  const diffMs = todayDate - sessionDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Future date check
  if (diffDays < 0) {
    return {
      isOpen: false,
      isFuture: true,
      deadlineTime: policy.daily_deadline_time,
      currentTime: now.timeStr,
      currentDate: now.dateStr,
      timezone: policy.timezone,
      reason: "Cannot mark attendance for a future date.",
    };
  }

  // Check if past allowed days
  if (diffDays > (policy.past_days_allowed || 0)) {
    return {
      isOpen: false,
      isPast: true,
      diffDays,
      pastDaysAllowed: policy.past_days_allowed,
      deadlineTime: policy.daily_deadline_time,
      currentTime: now.timeStr,
      currentDate: now.dateStr,
      timezone: policy.timezone,
      reason: `Attendance deadline passed (${diffDays} days ago; maximum allowed past days is ${policy.past_days_allowed}).`,
    };
  }

  // If today or within past allowed days, check time limit if strict
  if (diffDays === 0 && policy.daily_deadline_time) {
    const deadlineTime = policy.daily_deadline_time.length === 5 ? `${policy.daily_deadline_time}:00` : policy.daily_deadline_time;
    if (now.timeStr > deadlineTime) {
      return {
        isOpen: false,
        isPastTime: true,
        deadlineTime,
        currentTime: now.timeStr,
        currentDate: now.dateStr,
        timezone: policy.timezone,
        reason: `Daily attendance deadline of ${deadlineTime} has passed for today (Current time: ${now.timeStr} ${policy.timezone}).`,
      };
    }
  }

  return {
    isOpen: true,
    deadlineTime: policy.daily_deadline_time,
    currentTime: now.timeStr,
    currentDate: now.dateStr,
    timezone: policy.timezone,
    reason: "Attendance editing is open.",
  };
}

async function checkGradingWindow(examEndDateStr) {
  const policy = (await repo.findPolicyByType("grading")) || {
    grading_window_days: 14,
    timezone: "Asia/Kolkata",
    is_strict: 1,
  };

  const now = getNowInTimezone(policy.timezone);
  if (!examEndDateStr) {
    return {
      isOpen: true,
      reason: "No exam end date specified; grading is open.",
      currentDate: now.dateStr,
    };
  }

  const examEndDate = new Date(`${examEndDateStr}T00:00:00`);
  const deadlineDate = new Date(examEndDate);
  deadlineDate.setDate(deadlineDate.getDate() + (policy.grading_window_days || 14));

  const todayDate = new Date(`${now.dateStr}T00:00:00`);
  const remainingDays = Math.ceil((deadlineDate - todayDate) / (1000 * 60 * 60 * 24));

  const deadlineDateStr = deadlineDate.toISOString().split("T")[0];

  if (remainingDays < 0) {
    return {
      isOpen: false,
      examEndDate: examEndDateStr,
      deadlineDate: deadlineDateStr,
      daysRemaining: remainingDays,
      windowDays: policy.grading_window_days,
      timezone: policy.timezone,
      reason: `Grading window closed on ${deadlineDateStr} (${Math.abs(remainingDays)} day(s) ago).`,
    };
  }

  return {
    isOpen: true,
    examEndDate: examEndDateStr,
    deadlineDate: deadlineDateStr,
    daysRemaining: remainingDays,
    windowDays: policy.grading_window_days,
    timezone: policy.timezone,
    reason: `Grading is open until ${deadlineDateStr} (${remainingDays} day(s) remaining).`,
  };
}

module.exports = {
  getPolicies,
  updatePolicy,
  checkAttendanceWindow,
  checkGradingWindow,
  getNowInTimezone,
};
