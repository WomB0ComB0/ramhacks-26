import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import * as profiles from "@/features/profile/repository";
import * as careers from "./repository";
import { generateCareerMatches } from "@/services/ai/gemini";
import type { ProfileForPrompt } from "./prompt";

const router = Router();

router.use(requireAuth);

// AI generation — tighter per-user rate limit since each call hits Gemini.
// requireAuth runs first so req.auth.userId is always present here. We avoid
// referencing req.ip directly to satisfy express-rate-limit's IPv6 validator.
const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId ?? "anon",
});

const GenerateBody = z
  .object({
    limit: z.number().int().min(1).max(8).optional(),
    focus: z.string().min(1).max(120).optional(),
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
        message: "Complete onboarding (POST /api/profile) before generating matches.",
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

  try {
    const ai = await generateCareerMatches(profileForPrompt, parsed.data);
    const persisted = await careers.saveBatch(userId, ai);
    res.status(201).json({
      summary: ai.summary,
      reasoning: ai.reasoning,
      confidence: ai.confidence,
      nextSteps: ai.nextSteps,
      safetyNotes: ai.safetyNotes,
      recommendations: persisted,
    });
  } catch (err) {
    req.log?.error({ err }, "career generation failed");
    console.error("[careers] generation error:", err);
    res.status(503).json({
      error: {
        code: "ai_unavailable",
        message: "AI is having trouble. Try again in a minute.",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : String((err as Error)?.message ?? err).slice(0, 500),
      },
    });
  }
});

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const list = await careers.listForUser(userId);
  res.json({ recommendations: list });
});

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const row = await careers.getOne(userId, req.params.id);
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } });
    return;
  }
  res.json({ recommendation: row });
});

router.post("/:id/save", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const row = await careers.setSaved(userId, req.params.id, true);
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } });
    return;
  }
  res.json({ recommendation: row });
});

router.post("/:id/unsave", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const row = await careers.setSaved(userId, req.params.id, false);
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } });
    return;
  }
  res.json({ recommendation: row });
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  await careers.deleteOne(userId, req.params.id);
  res.status(204).end();
});

export default router;
