import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  userProfiles,
  careerRecommendations,
  opportunityRecommendations,
  actionPlans,
  skillInsights,
  networkingMessages,
  feedback,
} from "../db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// DELETE /api/me - wipe all app-side data for the authed user. The Better Auth
// row in neon_auth.user is intentionally left intact: account deletion goes
// through Better Auth's own flow (handled by the AccountView component).
router.delete("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;

  try {
    // Order matters where FKs exist (action_plans.anchor_career_id ->
    // career_recommendations.id, ON DELETE SET NULL). Deleting plans first
    // is defensive even though SET NULL would not block.
    await db.delete(actionPlans).where(eq(actionPlans.userId, userId));
    await db.delete(careerRecommendations).where(eq(careerRecommendations.userId, userId));
    await db
      .delete(opportunityRecommendations)
      .where(eq(opportunityRecommendations.userId, userId));
    await db.delete(skillInsights).where(eq(skillInsights.userId, userId));
    await db.delete(networkingMessages).where(eq(networkingMessages.userId, userId));
    await db.delete(feedback).where(eq(feedback.userId, userId));
    await db.delete(userProfiles).where(eq(userProfiles.userId, userId));

    res.status(200).json({ ok: true, deleted: { userId } });
  } catch (err) {
    req.log?.error({ err }, "delete-my-data failed");
    res.status(500).json({
      error: {
        code: "delete_failed",
        message: "Could not delete your data. Try again or contact support.",
      },
    });
  }
});

export default router;
