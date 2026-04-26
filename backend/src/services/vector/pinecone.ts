import { Pinecone, type Index } from "@pinecone-database/pinecone";
import { embedTexts, embedOne } from "../ai/embed";
import { OPPORTUNITIES, type Opportunity } from "../../data/opportunities";

// Optional vector layer. If PINECONE_API_KEY is unset, isEnabled() returns
// false and the route falls back to SQL-style ranking. This keeps the
// stretch milestone purely additive: prod doesn't break if Pinecone is down.

const NAMESPACE = "opportunities";

let cachedClient: Pinecone | null = null;
let cachedIndex: Index | null = null;

export function isEnabled(): boolean {
  return Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
}

function client(): Pinecone {
  if (!cachedClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("PINECONE_API_KEY not set");
    cachedClient = new Pinecone({ apiKey });
  }
  return cachedClient;
}

function index(): Index {
  if (!cachedIndex) {
    const name = process.env.PINECONE_INDEX;
    if (!name) throw new Error("PINECONE_INDEX not set");
    cachedIndex = client().index(name);
  }
  return cachedIndex;
}

// One stable string per opportunity used to compute its embedding. Keeping
// this deterministic means we can re-derive the same vector on any host.
function toEmbeddingText(o: Opportunity): string {
  return [
    o.name,
    o.organization,
    o.kind,
    o.oneLiner,
    o.description,
    `Tags: ${o.tags.join(", ")}`,
    `Skills: ${o.skills.join(", ")}`,
    `Audience: ${o.audience.join(", ")}`,
    o.location ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

interface SeedResult {
  attempted: number;
  upserted: number;
  alreadyPresent: number;
}

/**
 * Embed every catalog entry and upsert into Pinecone. Idempotent: looks at
 * current vector count first; skips if already populated unless force=true.
 *
 * Stores only slug as id and a small set of metadata so we can hydrate from
 * the in-memory catalog at query time.
 */
export async function seedOpportunities(
  opts: { force?: boolean } = {},
): Promise<SeedResult> {
  if (!isEnabled()) throw new Error("Pinecone not configured");
  const idx = index();

  if (!opts.force) {
    const stats = await idx.describeIndexStats();
    const existing = stats.namespaces?.[NAMESPACE]?.recordCount ?? 0;
    if (existing >= OPPORTUNITIES.length) {
      return { attempted: 0, upserted: 0, alreadyPresent: existing };
    }
  }

  const vectors = await embedTexts(OPPORTUNITIES.map(toEmbeddingText));
  const records = OPPORTUNITIES.map((o, i) => ({
    id: o.slug,
    values: vectors[i]!,
    metadata: { slug: o.slug, kind: o.kind, name: o.name },
  }));

  // Pinecone v7 SDK: namespace().upsert takes UpsertOptions{ records }.
  await idx.namespace(NAMESPACE).upsert({ records });
  return { attempted: records.length, upserted: records.length, alreadyPresent: 0 };
}

export interface VectorMatch {
  slug: string;
  score: number;
}

/**
 * Embed the query text and return the top-K closest opportunities.
 * Caller is responsible for hydrating from the catalog.
 */
export async function queryByText(query: string, topK = 12): Promise<VectorMatch[]> {
  if (!isEnabled()) throw new Error("Pinecone not configured");
  const vector = await embedOne(query);
  if (vector.length === 0) return [];
  const res = await index()
    .namespace(NAMESPACE)
    .query({ topK, vector, includeMetadata: false });
  return (res.matches ?? [])
    .filter((m) => typeof m.id === "string")
    .map((m) => ({ slug: m.id as string, score: m.score ?? 0 }));
}

/**
 * Build the textual blob used to embed the user's profile for matching.
 * Mirrors the catalog embedding text so cosine similarity is meaningful.
 */
export function buildProfileQueryText(profile: {
  major?: string | null;
  educationLevel?: string | null;
  experienceLevel?: string | null;
  interests?: string[];
  currentSkills?: string[];
  targetIndustries?: string[];
  careerGoals?: string | null;
}): string {
  return [
    profile.major ? `Major: ${profile.major}` : "",
    profile.educationLevel ? `Education: ${profile.educationLevel}` : "",
    profile.experienceLevel ? `Experience: ${profile.experienceLevel}` : "",
    profile.interests?.length ? `Interests: ${profile.interests.join(", ")}` : "",
    profile.currentSkills?.length ? `Skills: ${profile.currentSkills.join(", ")}` : "",
    profile.targetIndustries?.length
      ? `Target industries: ${profile.targetIndustries.join(", ")}`
      : "",
    profile.careerGoals ? `Goals: ${profile.careerGoals}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
