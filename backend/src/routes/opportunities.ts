import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import * as profiles from "../repositories/profiles";
import {
  OPPORTUNITIES,
  type Opportunity,
  type OpportunityKind,
  type OpportunityAudience,
} from "../data/opportunities";

const router = Router();

router.use(requireAuth);

const KIND_VALUES = [
  "fellowship",
  "internship",
  "bootcamp",
  "scholarship",
  "program",
  "community",
  "competition",
] as const satisfies readonly OpportunityKind[];

const MatchQuery = z
  .object({
    kind: z.enum(KIND_VALUES).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    remoteOnly: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),
    freeOnly: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),
  })
  .strict();

interface RankedOpportunity extends Opportunity {
  score: number;
  matchedTags: string[];
  matchedSkills: string[];
}

const norm = (s: string) => s.trim().toLowerCase();
const intersect = (a: string[], b: string[]) => {
  const set = new Set(a.map(norm));
  return b.filter((x) => set.has(norm(x)));
};

// Maps the profile's `educationLevel` (free-form string from onboarding) to the
// audience tags we tag opportunities with. Anything we don't recognize falls
// through to null (no boost or penalty during ranking).
function audienceFromEducation(level: string | null): OpportunityAudience | null {
  if (!level) return null;
  const v = level.toLowerCase();
  if (v.includes("high")) return "highschool";
  if (v.includes("phd") || v.includes("doctor") || v.includes("master") || v.includes("grad"))
    return "grad";
  if (v.includes("undergrad") || v.includes("bachelor") || v.includes("associate"))
    return "undergrad";
  if (v.includes("professional") || v.includes("working") || v.includes("industry"))
    return "professional";
  return null;
}

function scoreOpportunity(
  opp: Opportunity,
  profileTags: string[],
  profileSkills: string[],
  audience: OpportunityAudience | null,
): { score: number; matchedTags: string[]; matchedSkills: string[] } {
  const matchedTags = intersect(profileTags, opp.tags);
  const matchedSkills = intersect(profileSkills, opp.skills);

  let score = 0;
  score += matchedTags.length * 3;
  score += matchedSkills.length * 2;
  if (audience && (opp.audience.includes(audience) || opp.audience.includes("any"))) {
    score += 2;
  }
  if (opp.costUsd === 0) score += 0.5;
  if (opp.stipendUsd && opp.stipendUsd > 0) score += 1;
  return { score, matchedTags, matchedSkills };
}

router.get("/match", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;

  const parsed = MatchQuery.safeParse(req.query ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "validation_failed",
        message: "Invalid query parameters.",
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
        message: "Complete onboarding (POST /api/profile) before matching opportunities.",
      },
    });
    return;
  }

  const profileTags = [
    ...(profile.interests ?? []),
    ...(profile.targetIndustries ?? []),
  ];
  const profileSkills = profile.currentSkills ?? [];
  const audience = audienceFromEducation(profile.educationLevel);

  const { kind, limit, remoteOnly, freeOnly } = parsed.data;
  const limitN = limit ?? 10;

  const ranked: RankedOpportunity[] = OPPORTUNITIES.filter((o) =>
    kind ? o.kind === kind : true,
  )
    .filter((o) => (remoteOnly ? o.remoteOk : true))
    .filter((o) => (freeOnly ? o.costUsd === 0 : true))
    .map((o) => {
      const s = scoreOpportunity(o, profileTags, profileSkills, audience);
      return { ...o, ...s };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limitN);

  res.json({
    profileSnapshot: {
      tags: profileTags,
      skills: profileSkills,
      audience,
    },
    opportunities: ranked,
  });
});

router.get("/", (_req: Request, res: Response): void => {
  res.json({ opportunities: OPPORTUNITIES });
});

export default router;
