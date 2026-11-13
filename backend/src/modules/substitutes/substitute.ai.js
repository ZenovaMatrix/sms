"use strict";

/**
 * substitute.ai.js
 *
 * Dual-engine substitute teacher recommendation system:
 * 1. AI/LLM engine (Gemini API via standard REST endpoint) if GEMINI_API_KEY is available.
 * 2. High-precision rule-based scoring engine as reliable fallback.
 */

async function callGeminiApi(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }
  return JSON.parse(text);
}

/**
 * Rule-based fallback scoring engine
 */
function scoreRuleBased(candidates, context) {
  const { targetSubject, targetClass, targetDepartmentId } = context;

  return candidates.map((candidate) => {
    let score = 50; // base score for active faculty
    const matchFactors = [];
    const concerns = [];

    // 1. Direct Subject Match (highest weight)
    const teachesSubject = candidate.assigned_subjects?.some(
      (s) => s.subject_id === targetSubject.id || (s.subject_name && s.subject_name.toLowerCase() === targetSubject.subject_name?.toLowerCase())
    );
    if (teachesSubject) {
      score += 25;
      matchFactors.push(`Direct experience teaching ${targetSubject.subject_name}`);
    }

    // 2. Department Alignment
    if (candidate.department_id && candidate.department_id === targetDepartmentId) {
      score += 15;
      matchFactors.push(`Belongs to the ${candidate.department_name || "same"} department`);
    }

    // 3. Qualification Match
    const qual = (candidate.qualification || "").toLowerCase();
    const subName = (targetSubject.subject_name || "").toLowerCase();
    if (qual.includes(subName) || (subName.includes("math") && qual.includes("math")) || (subName.includes("sci") && qual.includes("sci"))) {
      score += 10;
      matchFactors.push(`Degree specialization aligns with subject (${candidate.qualification})`);
    }

    // 4. Grade / Class Level Experience
    const teachesClass = candidate.assigned_classes?.some((c) => c.class_id === targetClass.id);
    if (teachesClass) {
      score += 10;
      matchFactors.push(`Familiar with grade level ${targetClass.class_name}`);
    }

    // 5. Workload factor
    const assignmentCount = candidate.assigned_classes?.length || 0;
    if (assignmentCount <= 2) {
      score += 10;
      matchFactors.push(`Light current teaching load (${assignmentCount} classes)`);
    } else if (assignmentCount >= 5) {
      score -= 10;
      concerns.push(`Heavy existing workload (${assignmentCount} active classes)`);
    }

    // 6. Conflict penalty
    if (candidate.has_conflict) {
      score = Math.max(10, score - 50);
      concerns.push(`Timetable conflict detected on specified date/time`);
    }

    // Normalization to 0-99
    const finalScore = Math.min(99, Math.max(15, score));

    // Explanation synthesis
    let explanation = "";
    if (matchFactors.length > 0) {
      explanation = matchFactors.join(". ") + ".";
    } else {
      explanation = `Available faculty member with ${candidate.qualification || "general credentials"}.`;
    }
    if (concerns.length > 0) {
      explanation += " Note: " + concerns.join("; ") + ".";
    }

    return {
      teacher_id: candidate.id,
      teacher_name: `${candidate.first_name} ${candidate.last_name}`,
      employee_id: candidate.employee_id,
      department_name: candidate.department_name,
      qualification: candidate.qualification,
      phone: candidate.phone,
      score: finalScore,
      teaches_subject: teachesSubject,
      has_conflict: Boolean(candidate.has_conflict),
      match_factors: matchFactors,
      concerns,
      explanation,
      engine: "rule-based",
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Main recommendation generator
 */
async function generateRecommendations(candidates, context) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `You are EduManage AI Assistant for School Administration.
Rank the following substitute teacher candidates for covering a class.
Target Class: ${context.targetClass.class_name}
Target Subject: ${context.targetSubject.subject_name} (${context.targetSubject.subject_code || ""})
Target Date: ${context.date}
Absent Teacher: ${context.absentTeacherName}

Candidates Data:
${JSON.stringify(candidates, null, 2)}

Return a JSON array of objects with the following schema:
[
  {
    "teacher_id": "string",
    "score": number (0 to 100),
    "explanation": "concise 2-3 sentence explanation of suitability, workload, and expertise",
    "match_factors": ["string"],
    "concerns": ["string"]
  }
]
Sort descending by score.`;

      const aiResults = await callGeminiApi(prompt, apiKey);
      if (Array.isArray(aiResults) && aiResults.length > 0) {
        // Merge AI rankings with candidate info
        const candidateMap = new Map(candidates.map((c) => [c.id, c]));
        return aiResults
          .filter((res) => candidateMap.has(res.teacher_id))
          .map((res) => {
            const cand = candidateMap.get(res.teacher_id);
            return {
              teacher_id: cand.id,
              teacher_name: `${cand.first_name} ${cand.last_name}`,
              employee_id: cand.employee_id,
              department_name: cand.department_name,
              qualification: cand.qualification,
              phone: cand.phone,
              score: Math.min(100, Math.max(0, Number(res.score) || 75)),
              teaches_subject: cand.assigned_subjects?.some((s) => s.subject_id === context.targetSubject.id),
              has_conflict: Boolean(cand.has_conflict),
              match_factors: res.match_factors || [],
              concerns: res.concerns || [],
              explanation: res.explanation || "AI-recommended substitute based on profile and availability.",
              engine: "gemini-ai",
            };
          });
      }
    } catch (err) {
      console.warn("[SubstituteAI] Gemini call failed or unavailable, falling back to rule engine:", err.message);
    }
  }

  // Fallback to rule engine
  return scoreRuleBased(candidates, context);
}

module.exports = {
  generateRecommendations,
};

