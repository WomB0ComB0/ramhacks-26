import { z } from "zod";

// String maxes are defense-in-depth — relaxed so legitimate model verbosity
// doesn't fail validation. Tighten again post-hackathon if needed.

// Models occasionally return "medium"/"high"/"low" instead of the schema enum.
// Normalize before .enum() validation so a single synonym doesn't nuke an
// otherwise-good plan. Falls through unchanged if not a known synonym (the
// .enum() then rejects it loudly, which is what we want for true garbage).
const normalizeDifficulty = (raw: unknown) => {
  if (typeof raw !== "string") return raw;
  const v = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    easy: "easy",
    low: "easy",
    beginner: "easy",
    medium: "moderate",
    moderate: "moderate",
    intermediate: "moderate",
    hard: "hard",
    high: "hard",
    advanced: "hard",
    "very hard": "very_hard",
    very_hard: "very_hard",
    expert: "very_hard",
  };
  return map[v] ?? raw;
};

export const CareerMatch = z.object({
  title: z.string().min(2).max(200),
  fitReason: z.string().min(10).max(2000),
  requiredSkills: z.array(z.string()).max(20),
  missingSkills: z.array(z.string()).max(20),
  suggestedProjects: z
    .array(
      z.object({
        name: z.string().max(200),
        outline: z.string().max(1000),
        estTimeWeeks: z.number().min(1).max(104).optional(),
      }),
    )
    .max(8),
  entryRoles: z.array(z.string()).max(12),
  growthPath: z.array(z.string()).max(10),
  difficulty: z.preprocess(normalizeDifficulty, z.enum(["easy", "moderate", "hard", "very_hard"])),
  confidence: z.number().min(0).max(1),
  tradeoffs: z.string().max(2000),
});

export type CareerMatch = z.infer<typeof CareerMatch>;

export const CareerMatchResponse = z.object({
  summary: z.string().max(2000),
  recommendations: z.array(CareerMatch).min(1).max(8),
  reasoning: z.string().max(2000),
  confidence: z.number().min(0).max(1),
  nextSteps: z.array(z.string()).min(1).max(8),
  safetyNotes: z.string().max(2000).optional(),
});

// ---------- Action Plan ----------

export const ActionStep = z.object({
  action: z.string().max(400),
  why: z.string().max(800),
  estTimeHours: z.number().min(0.25).max(500),
  difficulty: z.preprocess(normalizeDifficulty, z.enum(["easy", "moderate", "hard"])),
  expectedOutcome: z.string().max(800),
  successCriteria: z.string().max(600),
  resources: z
    .array(
      z.object({
        label: z.string().max(200),
        url: z.string().url().optional(),
      }),
    )
    .max(6)
    .optional(),
});

export type ActionStep = z.infer<typeof ActionStep>;

export const ActionPlanResponse = z.object({
  summary: z.string().max(2000),
  sevenDayPlan: z.array(ActionStep).min(1).max(7),
  thirtyDayPlan: z.array(ActionStep).min(1).max(10),
  ninetyDayPlan: z.array(ActionStep).min(1).max(8),
  sixMonthPlan: z.array(ActionStep).max(6),
  longTermPlan: z.array(ActionStep).max(5),
  confidence: z.number().min(0).max(1),
  safetyNotes: z.string().max(2000).optional(),
});

export type ActionPlanResponse = z.infer<typeof ActionPlanResponse>;

export type CareerMatchResponse = z.infer<typeof CareerMatchResponse>;
