# AI Design — Prompts, Output Schemas, and Pinecone Strategy

> Covers deliverables 5 (prompt templates), 6 (Pinecone strategy), 7 (Gemini structured output schemas).
> All AI outputs are JSON-first, validated server-side before persistence.

---

## 1. Provider Abstractions

```ts
// backend/src/services/ai/provider.ts
export interface AIProvider {
  generate<T>(args: {
    system: string;
    user: string;
    schema: ZodSchema<T>;     // server-side validation
    responseSchema?: object;  // Gemini responseSchema (JSON Schema)
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<T>;

  embed(texts: string[]): Promise<number[][]>;
}

// backend/src/services/vector/provider.ts
export interface VectorProvider {
  upsert(namespace: string, items: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>): Promise<void>;
  query(namespace: string, vector: number[], opts: { topK: number; filter?: object }): Promise<Array<{ id: string; score: number; metadata?: Record<string, unknown> }>>;
}
```

Default impls: `GeminiProvider` (uses `@google/generative-ai`) and `PineconeProvider` (uses `@pinecone-database/pinecone`). Swap behind interface at composition root.

---

## 2. Gemini Configuration

- **Model**: `gemini-1.5-flash` for cost/latency in MVP. Upgrade to `gemini-1.5-pro` for high-stakes outputs (skill insights, action plans) if needed.
- **Embeddings**: `text-embedding-004` (768-dim).
- **Structured output**: pass `generationConfig: { responseMimeType: "application/json", responseSchema }`. Validate again with Zod before trusting.
- **Safety**: Use default safety settings; `BLOCK_MEDIUM_AND_ABOVE` for harassment/hate/sexual/dangerous.
- **Retries**: Exponential backoff up to 3 tries on parse-failure or 429/5xx.
- **Determinism**: temperature 0.4 for matchers, 0.6 for networking generator, 0.3 for action plans.

---

## 3. Output Schemas (Zod + Gemini responseSchema)

### 3.1 CareerMatch
```ts
import { z } from "zod";

export const CareerMatch = z.object({
  title: z.string(),
  fitReason: z.string(),
  requiredSkills: z.array(z.string()).max(15),
  missingSkills: z.array(z.string()),
  suggestedProjects: z.array(z.object({
    name: z.string(),
    outline: z.string(),
    estTimeWeeks: z.number().min(1).max(52),
  })).max(5),
  entryRoles: z.array(z.string()).max(8),
  growthPath: z.array(z.string()).max(6),
  difficulty: z.enum(["easy","moderate","hard","very_hard"]),
  confidence: z.number().min(0).max(1),
  tradeoffs: z.string(),
});

export const CareerMatchResponse = z.object({
  summary: z.string(),
  recommendations: z.array(CareerMatch).min(1).max(8),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  nextSteps: z.array(z.string()).min(1).max(5),
  safetyNotes: z.string().optional(),
});
```

### 3.2 OpportunityMatch
```ts
export const OpportunityMatch = z.object({
  opportunityId: z.string(),
  fitReason: z.string(),
  eligibilityCheck: z.enum(["likely_eligible","unclear","unlikely"]),
  matchScore: z.number().min(0).max(1),
  applicationSteps: z.array(z.string()).min(1).max(8),
  watchOuts: z.array(z.string()).optional(),
});

export const OpportunityMatchResponse = z.object({
  summary: z.string(),
  recommendations: z.array(OpportunityMatch).max(20),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  safetyNotes: z.string().optional(),
});
```

### 3.3 SkillInsight
```ts
export const SkillBucket = z.array(z.object({
  skill: z.string(),
  rationale: z.string(),
  priority: z.number().int().min(1).max(10),
}));

export const SkillInsight = z.object({
  mustHaveSkills: SkillBucket,
  shouldHaveSkills: SkillBucket,
  niceToHaveSkills: SkillBucket,
  gaps: z.array(z.string()),
  learningResources: z.array(z.object({
    skill: z.string(),
    title: z.string(),
    url: z.string().url().optional(),
    kind: z.enum(["course","book","tutorial","docs","video","project"]),
    estHours: z.number().min(0.5).max(500),
  })).max(40),
  certifications: z.array(z.object({
    name: z.string(),
    why: z.string(),
    optional: z.boolean(),
  })).optional(),
  prioritizedOrder: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  safetyNotes: z.string().optional(),
});
```

### 3.4 NetworkingMessage
```ts
export const NetworkingMessage = z.object({
  primary: z.string(),
  alternatives: z.array(z.string()).max(3),
  followUps: z.array(z.string()).max(2),
  questions: z.array(z.string()).optional(),
  tone: z.enum(["professional","casual","warm","confident","student","founder"]),
  channel: z.enum(["linkedin","email","other"]),
  notes: z.string().optional(),
});
```

### 3.5 ActionPlan
```ts
export const ActionStep = z.object({
  action: z.string(),
  why: z.string(),
  estTimeHours: z.number().min(0.25).max(200),
  difficulty: z.enum(["easy","moderate","hard"]),
  expectedOutcome: z.string(),
  successCriteria: z.string(),
  resources: z.array(z.object({ label: z.string(), url: z.string().url().optional() })).optional(),
});

export const ActionPlan = z.object({
  sevenDayPlan:   z.array(ActionStep).max(7),
  thirtyDayPlan:  z.array(ActionStep).max(10),
  ninetyDayPlan:  z.array(ActionStep).max(8),
  sixMonthPlan:   z.array(ActionStep).max(6),
  longTermPlan:   z.array(ActionStep).max(5),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  safetyNotes: z.string().optional(),
});
```

---

## 4. Prompt Templates

All prompts share a global system preamble that sets tone and safety rails. Each feature has a dedicated user template.

### 4.1 Global System Preamble (prepend to every call)

```
You are a career advisor for students, career switchers, and underrepresented talent.
RULES:
- Never make deterministic claims ("you will get..."). Always express uncertainty.
- Never infer protected characteristics (race, religion, disability) unless explicitly given AND relevant to opportunity eligibility.
- Every recommendation MUST include a specific next action — no generic advice like "network more" or "learn coding".
- Cite the user's own profile fields when explaining fit.
- Output ONLY valid JSON matching the provided schema. No prose outside the JSON.
- If you are unsure, lower the confidence score and explain the uncertainty in safetyNotes.
```

### 4.2 Career Matcher Prompt

```
USER PROFILE:
{{profileJson}}

RETRIEVED CAREER CONTEXT (top {{k}} similar careers from corpus):
{{retrievedCareersJson}}

INSTRUCTIONS:
- Recommend {{limit}} career paths the user has a realistic shot at given their constraints ({{profile.constraints}}).
- For each: explain fit by referencing the user's specific skills/interests/goals.
- Identify both must-have and currently-missing skills.
- Suggest 1–3 portfolio projects per path that fit the user's time/budget.
- Provide entry-level role titles + a 5-step growth path.
- Score difficulty and confidence honestly. Lower confidence for poorly-supported areas.
- Include tradeoffs (what the user gives up by choosing this path).

Return JSON matching the CareerMatchResponse schema exactly.
```

### 4.3 Opportunity Match Prompt

```
USER PROFILE:
{{profileJson}}

CANDIDATE OPPORTUNITIES (pre-filtered, top {{k}} from corpus):
{{candidatesJson}}

INSTRUCTIONS:
- For each candidate, decide eligibility (likely_eligible / unclear / unlikely) using ONLY the eligibility text and user profile.
- Write a fitReason that names which user attribute matches.
- List 3–6 concrete application steps in order.
- Flag watchOuts (deadlines, cost, time commitment, doc requirements).
- Score matchScore 0..1.
- Drop any candidate whose eligibility is clearly impossible.

Return JSON matching the OpportunityMatchResponse schema exactly.
```

### 4.4 Skill Insight Prompt

```
USER PROFILE:
{{profileJson}}

ANCHOR CAREER (optional):
{{anchorCareerJson}}

INSTRUCTIONS:
- Place each skill into must-have, should-have, or nice-to-have for the user's target.
- Identify gaps (skills user lacks but needs).
- Recommend learning resources that match user budget/schedule.
- Suggest certifications only if they meaningfully unblock opportunities.
- Output a prioritizedOrder array (skill names in best learning sequence).

Return JSON matching the SkillInsight schema.
```

### 4.5 Networking Message Prompt

```
USER PROFILE:
{{profileJson}}

OUTREACH CONTEXT:
- recipientType: {{recipientType}}
- messageType: {{messageType}}
- tone: {{tone}}
- recipient: {{context.recipientName}} ({{context.recipientRole}})
- sharedConnection: {{context.sharedConnection}}
- ask: {{context.askOrGoal}}

INSTRUCTIONS:
- Write a {{tone}} {{messageType}} appropriate for {{channel}}.
- Reference the shared connection naturally (no name-dropping).
- Make a specific, low-burden ask (≤20 minutes for an info interview).
- Avoid generic flattery; cite something concrete about the recipient's role.
- Provide 2 short alternatives with different angles.
- For info interviews, include 4–6 thoughtful questions.

Return JSON matching the NetworkingMessage schema.
```

### 4.6 Action Plan Prompt

```
USER PROFILE:
{{profileJson}}

ANCHOR CAREER (optional):
{{anchorCareerJson}}

SAVED OPPORTUNITIES (optional):
{{savedOpportunitiesJson}}

INSTRUCTIONS:
- Build a roadmap: 7-day, 30-day, 90-day, 6-month, long-term.
- Each step includes action / why / estTimeHours / difficulty / expectedOutcome / successCriteria.
- Honor user constraints (schedule, budget, transport).
- Sequence steps so each builds on the previous.
- Include at least one outreach step in the 30-day plan.
- Include at least one portfolio/project step before 90 days.

Return JSON matching the ActionPlan schema.
```

---

## 5. Pinecone Indexing & Retrieval Strategy

### 5.1 Index Layout

Single Pinecone index named `careers-mvp`, dim 768 (matching `text-embedding-004`), metric `cosine`. Use **namespaces** to separate corpora:

| Namespace | Doc kind | id | metadata |
|---|---|---|---|
| `careers` | one row per career path in the corpus | `career_<slug>` | `{ title, industries[], skills[], difficulty, source }` |
| `opportunities` | one row per program/fellowship/etc. | `opp_<uuid>` | `{ type, remote, location, cost, deadline, eligibilityKeywords[] }` |
| `skills` | one row per skill | `skill_<slug>` | `{ category, related_careers[] }` |
| `resources` | learning resources | `res_<uuid>` | `{ skill, kind, estHours, free }` |
| `users` | per-user profile summary (opt-in) | `user_<userId>` | `{ updatedAt }` only — no PII in metadata |

### 5.2 Embedding Texts

Embed a **single canonical text** per record. Example for opportunities:
```
"{name} — a {type} from {organization}. {description}. Eligibility: {eligibility}.
Location: {location}. Remote: {remote}. Cost: {cost}. Categories: {categories}."
```

For users (privacy-safe summary, **no name/email**):
```
"Major: CS. Education: undergraduate. Interests: ml, education, social impact.
Skills: python, react, sql. Target industries: edtech, nonprofit. Goals: ML for education access.
Constraints: part-time, low budget, remote-only."
```

### 5.3 Retrieval Pipeline

For career matching:
1. Embed user summary → vector v.
2. `query("careers", v, topK=12, filter={ matchesIndustry: true })` (metadata filter optional).
3. Fetch full career rows from Postgres by id.
4. Pass to Gemini as retrieved context.

For opportunities (MVP fallback when Pinecone is empty):
1. SQL filter on `opportunity_recommendations` seed (`type IN`, `remote`, `deadline > now`).
2. If Pinecone populated: embed user → query `opportunities` → re-rank top 30.
3. Send top 20 to Gemini for fitReason enrichment.

### 5.4 Upsert Lifecycle

- Build/seed: a CLI script `backend/scripts/seed-and-embed.ts` reads `backend/data/opportunities-seed.json`, upserts Postgres rows, computes embeddings in batches of 50 via `EmbeddingProvider.embed`, upserts to Pinecone.
- Re-embed: `POST /api/admin/embeddings/rebuild` (admin-only).
- User summary: re-embed on profile create/update (debounced 5s).

### 5.5 Cost & Privacy

- Embed in batches; cache by content-hash (skip re-embed when text unchanged).
- Never store raw user text in Pinecone metadata — only the vector + an updatedAt. Source-of-truth lives in Postgres.
- User opt-out: setting that disables `users` namespace upsert and clears their vector.

---

## 6. Validation & Failure Handling

```ts
// backend/src/services/ai/run.ts (sketch)
async function runStructured<T>(provider: AIProvider, opts: {...}, schema: ZodSchema<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await provider.generate({ ...opts, schema });
      return schema.parse(raw);
    } catch (e) {
      if (attempt === 2) throw e;
      // ask the model to "Output JSON only that satisfies the schema. Previous error: <e>"
    }
  }
  throw new Error("unreachable");
}
```

If three attempts fail, return `503 ai_unavailable` to the client; never persist invalid AI output.
