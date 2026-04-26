import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { ProfileInput, ProfilePatch } from "./types";
import * as profiles from "./repository";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const profile = await profiles.getByUserId(userId);
  if (!profile) {
    res.status(404).json({
      error: { code: "not_found", message: "No profile yet. Complete onboarding." },
    });
    return;
  }
  res.json({ profile });
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const parsed = ProfileInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "validation_failed",
        message: "Invalid profile.",
        details: z.flattenError(parsed.error),
      },
    });
    return;
  }
  const profile = await profiles.upsertProfile(userId, parsed.data);
  res.status(201).json({ profile });
});

router.patch("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const parsed = ProfilePatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "validation_failed",
        message: "Invalid patch.",
        details: z.flattenError(parsed.error),
      },
    });
    return;
  }
  const profile = await profiles.updateProfile(userId, parsed.data);
  if (!profile) {
    res.status(404).json({
      error: { code: "not_found", message: "No profile to update." },
    });
    return;
  }
  res.json({ profile });
});

router.delete("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  await profiles.deleteProfile(userId);
  res.status(204).end();
});

export default router;
