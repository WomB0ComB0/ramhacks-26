import { z } from "zod";

const tagList = z.array(z.string().trim().min(1).max(64)).max(40);

const Location = z
  .object({
    country: z.string().max(2).optional(),
    region: z.string().max(64).optional(),
    city: z.string().max(120).optional(),
    remoteOk: z.boolean().optional(),
  })
  .strict();

const Constraints = z
  .object({
    schedule: z.string().max(200).optional(),
    budget: z.string().max(200).optional(),
    transport: z.string().max(200).optional(),
    accessibility: z.string().max(200).optional(),
    other: z.string().max(500).optional(),
  })
  .strict();

export const ProfileInput = z
  .object({
    major: z.string().trim().min(1).max(120),
    educationLevel: z.enum([
      "high_school",
      "undergraduate",
      "graduate",
      "phd",
      "bootcamp",
      "self_taught",
      "professional",
      "other",
    ]),
    location: Location.optional(),
    experienceLevel: z.enum(["none", "entry", "mid", "senior"]),
    interests: tagList,
    currentSkills: tagList,
    targetIndustries: tagList,
    careerGoals: z.string().trim().min(1).max(2000),
    constraints: Constraints.optional(),
    preferredWorkStyle: z.array(z.string().max(64)).max(10).default([]),
  })
  .strict();

export const ProfilePatch = ProfileInput.partial();

export type ProfileInput = z.infer<typeof ProfileInput>;
export type ProfilePatch = z.infer<typeof ProfilePatch>;

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
