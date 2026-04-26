export interface ProfileForPrompt {
  major: string | null;
  educationLevel: string | null;
  experienceLevel: string | null;
  interests: string[];
  currentSkills: string[];
  targetIndustries: string[];
  careerGoals: string | null;
  constraints: Record<string, unknown> | null;
  location: Record<string, unknown> | null;
  preferredWorkStyle: string[];
}

export const CAREER_SYSTEM = `You are a career advisor for students, career switchers, and underrepresented talent.
RULES:
- Never make deterministic claims ("you will get this job"). Always express uncertainty.
- Never infer protected characteristics (race, religion, disability) unless explicitly given AND relevant to opportunity eligibility.
- Every recommendation MUST include a specific next action — no generic advice like "network more" or "learn coding".
- Cite the user's own profile fields when explaining fit.
- Output ONLY valid JSON matching the provided response schema. No prose outside the JSON.
- If you are unsure, lower the confidence score and explain the uncertainty in safetyNotes.`;

export function buildCareerPrompt(
  profile: ProfileForPrompt,
  opts: { limit?: number; focus?: string } = {},
): string {
  const limit = opts.limit ?? 5;
  const focusLine = opts.focus ? `\nFOCUS: ${opts.focus}\n` : "";

  // Fence the user-supplied content so the model treats it as data, not
  // instructions (defense-in-depth against prompt injection).
  const profileJson = JSON.stringify(profile, null, 2);

  return `<<<USER_PROFILE>>>
${profileJson}
<<<END_USER_PROFILE>>>
${focusLine}
INSTRUCTIONS:
- Recommend ${limit} career paths the user has a realistic shot at given their constraints.
- For each path: explain fit by referencing the user's specific skills, interests, and goals.
- List required skills AND which of those the user is currently missing.
- Suggest 1–3 portfolio projects per path that fit the user's time/budget.
- Provide entry-level role titles (3–6) and a 5-step growth path.
- Score difficulty (easy/moderate/hard/very_hard) and confidence (0..1) honestly.
- Lower confidence when evidence is thin; explain why in safetyNotes.
- Include tradeoffs (what the user gives up by choosing this path).
- nextSteps[] should contain 3–5 concrete actions the user can take this week.

Return JSON only — match the response schema exactly.`;
}
