import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import * as profiles from "../repositories/profiles";
import * as opportunityRepo from "../repositories/opportunities";
import * as vector from "../services/vector/pinecone";
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

  // M8 stretch: if Pinecone is configured, use semantic similarity. We only
  // engage vector mode when there's no kind/remote/free filter — Pinecone
  // metadata filters are doable but not worth the complexity for hackathon.
  // The catch returns to SQL ranking on any vector failure (network, quota).
  if (vector.isEnabled() && !kind && !remoteOnly && !freeOnly) {
    try {
      // Lazy seed: if the index is empty, populate it. Idempotent.
      await vector.seedOpportunities();
      const queryText = vector.buildProfileQueryText({
        major: profile.major,
        educationLevel: profile.educationLevel,
        experienceLevel: profile.experienceLevel,
        interests: profile.interests ?? [],
        currentSkills: profile.currentSkills ?? [],
        targetIndustries: profile.targetIndustries ?? [],
        careerGoals: profile.careerGoals,
      });
      const matches = await vector.queryByText(queryText, limitN);
      const bySlug = new Map(OPPORTUNITIES.map((o) => [o.slug, o]));
      const ranked: RankedOpportunity[] = matches
        .map((m) => {
          const opp = bySlug.get(m.slug);
          if (!opp) return null;
          const detail = scoreOpportunity(opp, profileTags, profileSkills, audience);
          return { ...opp, ...detail, score: m.score };
        })
        .filter((x): x is RankedOpportunity => x !== null);
      res.json({
        profileSnapshot: { tags: profileTags, skills: profileSkills, audience },
        opportunities: ranked,
        rankingMode: "vector" as const,
      });
      return;
    } catch (err) {
      console.warn(
        "[opportunities] vector path failed, falling back to SQL:",
        String((err as Error).message ?? err).slice(0, 200),
      );
      // fall through to SQL ranking
    }
  }

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
    rankingMode: "tag-overlap" as const,
  });
});

router.get("/", (_req: Request, res: Response): void => {
  res.json({ opportunities: OPPORTUNITIES });
});

const SaveBody = z.object({ slug: z.string().min(1).max(120) }).strict();

router.post("/save", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const parsed = SaveBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "validation_failed",
        message: "Invalid save body.",
        details: z.flattenError(parsed.error),
      },
    });
    return;
  }
  const opp = OPPORTUNITIES.find((o) => o.slug === parsed.data.slug);
  if (!opp) {
    res.status(404).json({
      error: { code: "not_found", message: "Unknown opportunity slug." },
    });
    return;
  }
  const row = await opportunityRepo.saveCatalogEntry(userId, opp);
  res.status(201).json({ opportunity: row });
});

router.get("/saved", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const rows = await opportunityRepo.listSaved(userId);
  res.json({ opportunities: rows });
});

router.post("/:id/unsave", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const row = await opportunityRepo.setSaved(userId, req.params.id, false);
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Not found." } });
    return;
  }
  res.json({ opportunity: row });
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  await opportunityRepo.deleteOne(userId, req.params.id);
  res.status(204).end();
});

export default router;
