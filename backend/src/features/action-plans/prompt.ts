import type { ProfileForPrompt } from "@/features/careers/prompt";

export const ACTION_PLAN_SYSTEM = `You are a career coach for students, career switchers, and underrepresented talent.
RULES:
- Never make deterministic claims ("you will get X"). Always express uncertainty.
- Every step MUST be a specific, actionable thing the user can start today - no generic advice like "network more".
- Cite the user's profile (skills, goals, constraints) when relevant.
- Honor the user's constraints (schedule, budget, transport, accessibility).
- Sequence steps so each builds on the previous.
- Include at least one outreach step in the 30-day plan.
- Include at least one portfolio/project step before the 90-day mark.
- Output ONLY valid JSON matching the response schema. No prose outside the JSON.
- If you are unsure, lower the confidence score and explain in safetyNotes.`;

export interface ActionPlanContext {
  profile: ProfileForPrompt;
  anchorCareer?: {
    title: string;
    fitReason: string;
    missingSkills: string[];
    requiredSkills: string[];
  };
  savedOpportunities?: Array<{ name: string; type: string; deadline?: string | null }>;
}

export function buildActionPlanPrompt(ctx: ActionPlanContext): string {
  const profileJson = JSON.stringify(ctx.profile, null, 2);
  const anchorBlock = ctx.anchorCareer
    ? `\n<<<ANCHOR_CAREER>>>\n${JSON.stringify(ctx.anchorCareer, null, 2)}\n<<<END_ANCHOR_CAREER>>>\n`
    : "";
  const savedBlock =
    ctx.savedOpportunities && ctx.savedOpportunities.length > 0
      ? `\n<<<SAVED_OPPORTUNITIES>>>\n${JSON.stringify(ctx.savedOpportunities, null, 2)}\n<<<END_SAVED_OPPORTUNITIES>>>\n`
      : "";

  return `<<<USER_PROFILE>>>
${profileJson}
<<<END_USER_PROFILE>>>
${anchorBlock}${savedBlock}
INSTRUCTIONS:
- Build a roadmap in five horizons: 7-day, 30-day, 90-day, 6-month, long-term.
- Each step has: action / why / estTimeHours / difficulty / expectedOutcome / successCriteria / resources?
- difficulty MUST be exactly one of: "easy" | "moderate" | "hard" (no other values, no synonyms).
- 7-day: 3-7 quick wins the user can start this week (1-10h each).
- 30-day: 4-10 deeper steps that build skill or network (5-40h each, must include >=1 outreach step).
- 90-day: 3-8 milestone steps (e.g. complete a project, apply to programs).
- 6-month: 2-6 strategic moves (deeper specialization, larger projects).
- Long-term: 2-5 directional choices (12-24+ months out).
- successCriteria must be observable ("PR merged", "5 replies received", "course finished"), not vague.
- estTimeHours is realistic; don't underestimate.
- resources[] (optional): name + URL, only if you're confident the URL is real and current.
- summary: 2-3 sentences explaining the plan's narrative arc.
- confidence: honest 0..1.

Return JSON only - match the response schema exactly.`;
}
