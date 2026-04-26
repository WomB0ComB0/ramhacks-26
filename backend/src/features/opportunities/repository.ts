import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunityRecommendations } from "@/db/schema";
import type { Opportunity } from "./catalog";

// Snapshot a catalog entry into the per-user opportunity_recommendations table.
// We store the full record (not just the slug) so the user's saved list is
// stable even if the catalog is later edited or pruned.
function toRow(userId: string, opp: Opportunity, score = 0) {
  const costStr = opp.costUsd === 0 ? "Free" : `$${opp.costUsd}`;
  const stipendNote = opp.stipendUsd ? ` (stipend $${opp.stipendUsd})` : "";
  return {
    userId,
    sourceId: opp.slug,
    name: opp.name,
    organization: opp.organization ?? null,
    type: opp.kind,
    description: opp.description,
    eligibility: opp.eligibility.join("\n"),
    deadline: null,
    url: opp.applyUrl,
    location: opp.location ?? null,
    remote: opp.remoteOk,
    cost: costStr + stipendNote,
    fitReason: null,
    eligibilityCheck: null,
    matchScore: score,
    applicationSteps: opp.applicationSteps,
    watchOuts: [],
    saved: true,
  } satisfies typeof opportunityRecommendations.$inferInsert;
}

export async function listSaved(userId: string, limit = 50) {
  return db
    .select()
    .from(opportunityRecommendations)
    .where(
      and(
        eq(opportunityRecommendations.userId, userId),
        eq(opportunityRecommendations.saved, true),
      ),
    )
    .orderBy(desc(opportunityRecommendations.createdAt))
    .limit(limit);
}

export async function findBySlug(userId: string, slug: string) {
  const rows = await db
    .select()
    .from(opportunityRecommendations)
    .where(
      and(
        eq(opportunityRecommendations.userId, userId),
        eq(opportunityRecommendations.sourceId, slug),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getOne(userId: string, id: string) {
  const rows = await db
    .select()
    .from(opportunityRecommendations)
    .where(
      and(eq(opportunityRecommendations.userId, userId), eq(opportunityRecommendations.id, id)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function saveCatalogEntry(userId: string, opp: Opportunity, score = 0) {
  // If the user already saved-then-unsaved this slug, flip the existing row
  // back on instead of creating a duplicate.
  const existing = await findBySlug(userId, opp.slug);
  if (existing) {
    if (existing.saved) return existing;
    const [updated] = await db
      .update(opportunityRecommendations)
      .set({ saved: true })
      .where(eq(opportunityRecommendations.id, existing.id))
      .returning();
    return updated ?? existing;
  }
  const [row] = await db
    .insert(opportunityRecommendations)
    .values(toRow(userId, opp, score))
    .returning();
  return row;
}

export async function setSaved(userId: string, id: string, saved: boolean) {
  const [row] = await db
    .update(opportunityRecommendations)
    .set({ saved })
    .where(
      and(eq(opportunityRecommendations.userId, userId), eq(opportunityRecommendations.id, id)),
    )
    .returning();
  return row ?? null;
}

export async function deleteOne(userId: string, id: string) {
  await db
    .delete(opportunityRecommendations)
    .where(
      and(eq(opportunityRecommendations.userId, userId), eq(opportunityRecommendations.id, id)),
    );
}
