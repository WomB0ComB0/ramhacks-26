import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import * as profiles from "../repositories/profiles";
import * as careers from "../repositories/careers";
import * as plans from "../repositories/plans";
import { generateActionPlan } from "../services/ai/gemini";
import type { ActionPlanContext } from "../services/ai/prompts/actionPlan";
import type { ProfileForPrompt } from "../services/ai/prompts/career";

const router = Router();

router.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId ?? "anon",
});

const GenerateBody = z
  .object({
    anchorCareerId: z.string().uuid().optional(),
  })
  .strict();

router.post("/generate", aiLimiter, async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;

  const parsed = GenerateBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "validation_failed",
        message: "Invalid generate options.",
        details: z.flattenError(parsed.error),
      },
    });
    return;
  }

  const profile = await profiles.getByUserId(userId);
  if (!profile) {
    res.status(409).json({
      error: {
        code: "profile_required",
        message: "Complete onboarding (POST /api/profile) before generating a plan.",
      },
    });
    return;
  }

  const profileForPrompt: ProfileForPrompt = {
    major: profile.major ?? null,
    educationLevel: profile.educationLevel ?? null,
    experienceLevel: profile.experienceLevel ?? null,
    interests: profile.interests ?? [],
    currentSkills: profile.currentSkills ?? [],
    targetIndustries: profile.targetIndustries ?? [],
    careerGoals: profile.careerGoals ?? null,
    constraints: (profile.constraints as Record<string, unknown> | null) ?? null,
    location: (profile.location as Record<string, unknown> | null) ?? null,
    preferredWorkStyle: profile.preferredWorkStyle ?? [],
  };

  let anchorCareer: ActionPlanContext["anchorCareer"];
  if (parsed.data.anchorCareerId) {
    const c = await careers.getOne(userId, parsed.data.anchorCareerId);
    if (c) {
      anchorCareer = {
        title: c.title,
        fitReason: c.fitReason,
        missingSkills: c.missingSkills ?? [],
        requiredSkills: c.requiredSkills ?? [],
      };
    }
  }

  try {
    const ai = await generateActionPlan({ profile: profileForPrompt, anchorCareer });
    const persisted = await plans.savePlan(userId, ai, parsed.data.anchorCareerId ?? null);
    res.status(201).json({
      summary: ai.summary,
      confidence: ai.confidence,
      safetyNotes: ai.safetyNotes,
      plan: persisted,
    });
  } catch (err) {
    const e = err as { message?: string; name?: string; status?: number; cause?: unknown };
    req.log?.error({ err }, "action plan generation failed");
    console.error("[action-plans] generation error:", err);
    console.error("[action-plans] error.name:", e?.name, "status:", e?.status, "cause:", e?.cause);
    res.status(503).json({
      error: {
        code: "ai_unavailable",
        message: "AI is having trouble. Try again in a minute.",
        // TEMP: expose details in prod while we diagnose. Revert after fix.
        details: String(e?.message ?? err).slice(0, 500),
      },
    });
  }
});

router.get("/latest", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const row = await plans.getLatest(userId);
  // 200 with `plan: null` so the browser DevTools doesn't flag absence as a network error.
  res.json({ plan: row ?? null });
});

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const list = await plans.listForUser(userId);
  res.json({ plans: list });
});

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const row = await plans.getOne(userId, req.params.id);
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } });
    return;
  }
  res.json({ plan: row });
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  await plans.deleteOne(userId, req.params.id);
  res.status(204).end();
});

export default router;
