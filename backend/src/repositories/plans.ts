import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { actionPlans } from "../db/schema";
import type { ActionPlanResponse } from "../services/ai/schemas";

export async function getLatest(userId: string) {
  const rows = await db
    .select()
    .from(actionPlans)
    .where(eq(actionPlans.userId, userId))
    .orderBy(desc(actionPlans.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listForUser(userId: string, limit = 20) {
  return db
    .select()
    .from(actionPlans)
    .where(eq(actionPlans.userId, userId))
    .orderBy(desc(actionPlans.createdAt))
    .limit(limit);
}

export async function getOne(userId: string, id: string) {
  const rows = await db
    .select()
    .from(actionPlans)
    .where(and(eq(actionPlans.userId, userId), eq(actionPlans.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteOne(userId: string, id: string) {
  await db
    .delete(actionPlans)
    .where(and(eq(actionPlans.userId, userId), eq(actionPlans.id, id)));
}

export async function savePlan(
  userId: string,
  plan: ActionPlanResponse,
  anchorCareerId?: string | null,
): Promise<typeof actionPlans.$inferSelect> {
  const [row] = await db
    .insert(actionPlans)
    .values({
      userId,
      sevenDayPlan: plan.sevenDayPlan,
      thirtyDayPlan: plan.thirtyDayPlan,
      ninetyDayPlan: plan.ninetyDayPlan,
      sixMonthPlan: plan.sixMonthPlan,
      longTermPlan: plan.longTermPlan,
      summary: plan.summary,
      confidence: plan.confidence,
      anchorCareerId: anchorCareerId ?? null,
    })
    .returning();
  return row;
}
