import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { careerRecommendations } from "@/db/schema";
import type { CareerMatchResponse } from "@/services/ai/schemas";

export async function listForUser(userId: string, limit = 20) {
  return db
    .select()
    .from(careerRecommendations)
    .where(eq(careerRecommendations.userId, userId))
    .orderBy(desc(careerRecommendations.createdAt))
    .limit(limit);
}

export async function getOne(userId: string, id: string) {
  const rows = await db
    .select()
    .from(careerRecommendations)
    .where(and(eq(careerRecommendations.userId, userId), eq(careerRecommendations.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function setSaved(userId: string, id: string, saved: boolean) {
  const [row] = await db
    .update(careerRecommendations)
    .set({ saved })
    .where(and(eq(careerRecommendations.userId, userId), eq(careerRecommendations.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteOne(userId: string, id: string) {
  await db
    .delete(careerRecommendations)
    .where(and(eq(careerRecommendations.userId, userId), eq(careerRecommendations.id, id)));
}

/**
 * Persist a fresh AI batch. History is kept — old generations stay browsable.
 */
export async function saveBatch(
  userId: string,
  batch: CareerMatchResponse,
): Promise<Array<typeof careerRecommendations.$inferSelect>> {
  const rows = batch.recommendations.map((r) => ({
    userId,
    title: r.title,
    description: null,
    fitReason: r.fitReason,
    requiredSkills: r.requiredSkills,
    missingSkills: r.missingSkills,
    suggestedProjects: r.suggestedProjects,
    entryRoles: r.entryRoles,
    growthPath: r.growthPath,
    confidenceScore: r.confidence,
    difficulty: r.difficulty,
    tradeoffs: r.tradeoffs,
    aiExplanation: batch.reasoning,
    saved: false,
  }));
  if (rows.length === 0) return [];
  return db.insert(careerRecommendations).values(rows).returning();
}
