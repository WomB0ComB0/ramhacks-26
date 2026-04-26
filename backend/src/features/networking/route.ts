import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import * as profiles from "@/features/profile/repository";
import * as networkingRepo from "./repository";
import { generateNetworkingMessage } from "@/services/ai/gemini";
import type { NetworkingContext } from "./prompt";

const router = Router();

router.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId ?? "anon",
});

const Channel = z.enum(["linkedin", "email", "twitter", "in_person"]);
const Tone = z.enum(["warm", "professional", "concise", "enthusiastic", "humble"]);
const RecipientType = z.enum([
  "recruiter",
  "engineer",
  "founder",
  "professor",
  "alum",
  "mentor",
  "peer",
]);

const GenerateBody = z
  .object({
    recipient: z
      .object({
        type: RecipientType,
        name: z.string().max(120).optional(),
        role: z.string().max(200).optional(),
        organization: z.string().max(200).optional(),
        sharedConnection: z.string().max(200).optional(),
      })
      .strict(),
    channel: Channel,
    tone: Tone,
    ask: z.string().min(5).max(1000),
    context: z.string().max(2000).optional(),
  })
  .strict();

router.post("/generate", aiLimiter, async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const parsed = GenerateBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "validation_failed",
        message: "Invalid request body.",
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
        message: "Complete onboarding (POST /api/profile) before generating outreach.",
      },
    });
    return;
  }

  const ctx: NetworkingContext = {
    senderProfile: {
      name: req.auth!.name,
      role: profile.major ?? undefined,
      interests: profile.interests ?? [],
      skills: profile.currentSkills ?? [],
      careerGoals: profile.careerGoals,
    },
    recipient: parsed.data.recipient,
    channel: parsed.data.channel,
    tone: parsed.data.tone,
    ask: parsed.data.ask,
    context: parsed.data.context,
  };

  try {
    const ai = await generateNetworkingMessage(ctx);
    const row = await networkingRepo.save({ userId, ctx, ai });
    res.status(201).json({
      message: ai.message,
      alternatives: ai.alternatives,
      followUps: ai.followUps,
      questions: ai.questions,
      subjectLine: ai.subjectLine,
      toneNotes: ai.toneNotes,
      saved: row,
    });
  } catch (err) {
    req.log?.error({ err }, "networking generation failed");
    console.error("[networking] generation error:", err);
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
  const list = await networkingRepo.listForUser(userId);
  res.json({ messages: list });
});

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const row = await networkingRepo.getOne(userId, req.params.id);
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } });
    return;
  }
  res.json({ message: row });
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  await networkingRepo.deleteOne(userId, req.params.id);
  res.status(204).end();
});

export default router;
