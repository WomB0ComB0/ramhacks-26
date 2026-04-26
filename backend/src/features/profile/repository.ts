import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { userProfiles } from "@/db/schema";
import type { ProfileInput, ProfilePatch } from "./types";

export async function getByUserId(userId: string) {
  const rows = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertProfile(userId: string, input: ProfileInput) {
  const [row] = await db
    .insert(userProfiles)
    .values({
      userId,
      major: input.major,
      educationLevel: input.educationLevel,
      location: input.location,
      experienceLevel: input.experienceLevel,
      interests: input.interests,
      currentSkills: input.currentSkills,
      targetIndustries: input.targetIndustries,
      careerGoals: input.careerGoals,
      constraints: input.constraints,
      preferredWorkStyle: input.preferredWorkStyle,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        major: input.major,
        educationLevel: input.educationLevel,
        location: input.location,
        experienceLevel: input.experienceLevel,
        interests: input.interests,
        currentSkills: input.currentSkills,
        targetIndustries: input.targetIndustries,
        careerGoals: input.careerGoals,
        constraints: input.constraints,
        preferredWorkStyle: input.preferredWorkStyle,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row;
}

export async function updateProfile(userId: string, patch: ProfilePatch) {
  const [row] = await db
    .update(userProfiles)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(userProfiles.userId, userId))
    .returning();
  return row ?? null;
}

export async function deleteProfile(userId: string) {
  await db.delete(userProfiles).where(eq(userProfiles.userId, userId));
}
