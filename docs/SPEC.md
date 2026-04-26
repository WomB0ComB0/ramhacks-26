# AI Career & Opportunity Matcher — Product Spec

> Refined product specification, system architecture, MVP scope, future roadmap, and milestones.
> Companion docs: [API.md](./API.md), [AI.md](./AI.md), [FRONTEND.md](./FRONTEND.md), [SECURITY.md](./SECURITY.md).

---

## 1. Product Vision

A personalized AI assistant that converts a user's background into a **concrete, prioritized action plan** for careers, opportunities, and networking — replacing generic advice ("learn coding", "network more") with specific next steps grounded in real programs and the user's constraints.

**Why this exists:** First-gen students, career switchers, and underrepresented talent often lack inherited career capital — mentors, alumni networks, knowledge of which fellowships exist. Tools like LinkedIn rank for popularity; this app ranks for *fit* and *accessibility*, surfacing nonprofits, fellowships, scholarships, and community programs that mainstream platforms hide.

**Differentiator:** Every recommendation includes a specific action item, a "why this fits you" reason rooted in the user's profile, and an honest confidence score with tradeoffs.

---

## 2. Target Users

| Persona | Primary need |
|---|---|
| College student | Discover realistic paths from major + interests |
| First-gen student | Find programs/fellowships peers don't know about |
| Career switcher | Map transferable skills, identify gaps, sequence learning |
| Underrepresented tech talent | Find supportive nonprofits + mentorship channels |
| Early-career professional | Plan next 6-month growth steps + outreach strategy |

---

## 3. Core Features (5)

1. **AI Career Matcher** — structured career path recommendations with fit reasoning, skills, projects, growth, and confidence.
2. **Nonprofit & Opportunity Recommender** — fellowships, bootcamps, scholarships, mentorship, OSS communities, with eligibility + application steps.
3. **Networking Advice Generator** — outreach targets, message drafts (LinkedIn/email/follow-up), tone-adjustable.
4. **Skills Insight & Development** — must/should/nice-to-have, gaps, resources, projects, certifications.
5. **Personalized Action Plan** — 7d / 30d / 90d / 6mo / long-term with action item, why, time, difficulty, success criteria, links.

(Detailed prompts and output schemas in [AI.md](./AI.md).)

---

## 4. Suggested System Architecture

```
┌──────────────────┐    HTTPS     ┌────────────────────────┐
│ Vite + React 19  │ ───────────► │ Express API (Node)     │
│ Stack/Neon Auth  │              │ - Stack auth middleware│
│ TanStack Query   │              │ - /api/* routes        │
│ React Router     │              │ - rate limit + helmet  │
└──────────────────┘              └──────────┬─────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              ▼                              ▼                              ▼
      ┌───────────────────────┐     ┌──────────────────┐           ┌────────────────┐
      │ Neon Postgres         │     │ Pinecone         │           │ Gemini API     │
      │ + Drizzle ORM         │     │ (vector search)  │           │ - LLM (1.5)    │
      │ - public schema (app) │     │ over careers,    │           │ - embeddings   │
      │ - neon_auth.users_sync│     │ opportunities,   │           │   (text-embed- │
      │   (managed by Stack)  │     │ user summaries   │           │    ding-004)   │
      └───────────────────────┘     └──────────────────┘           └────────────────┘
                                             │                              │
                                             └─────── abstracted via ──────┘
                                                  VectorProvider /
                                                  EmbeddingProvider /
                                                  AIProvider interfaces
```

**Layered abstractions** (in `backend/src/services/`):
- `AIProvider` — `generate(prompt, schema)` / `stream(...)` / `embed(text[])`. Default: Gemini. Swap for OpenAI/Claude later.
- `VectorProvider` — `upsert(ns, items[])` / `query(ns, vector, filter, k)`. Default: Pinecone. Swap for pgvector later.
- `OpportunityProvider` — `search(filters)` / `byId(id)`. Default: static seed JSON for MVP. Swap for live APIs later.
- `EmbeddingProvider` — `embed(texts[])`. Default: Gemini text-embedding-004.

---

## 5. AI Pipeline

```
1. User completes onboarding form
2. Server normalizes profile → structured JSON (Zod-validated)
3. Persist profile to Postgres via Drizzle
4. Compute "user profile summary" (privacy-safe text blob)
5. Embed summary → query Pinecone for top-K career/opportunity matches
6. Build structured prompt: { profile, retrieved_context, schema_instruction }
7. Gemini call with responseMimeType="application/json" + responseSchema
8. Validate AI response against Zod schema; reject + retry on failure
9. Persist recommendations + render confidence/uncertainty
10. User feedback (thumbs/notes) → feedback table → future re-rank signal
```

Every Gemini response **must** include: `summary`, `recommendations[]`, `reasoning`, `confidence` (0-1), `nextSteps[]`, `safetyNotes` (uncertainty/limits).

---

## 6. MVP Scope (Hackathon Slice)

**Ship in 24–48h:**
- Neon Auth (Stack) sign-up, sign-in, session — `users` live in `neon_auth.users_sync`, JOIN-able from app tables
- Onboarding form → `user_profiles`
- Career Matcher endpoint + page (Gemini structured JSON, ~3-5 careers)
- Opportunity Recommender from a **static seed of ~50 curated programs** (filter by SQL `WHERE`, no Pinecone yet)
- Action Plan generator (Gemini, 7d/30d/90d only)
- Save + list recommendations
- Settings page with delete-my-data button

**Defer to post-MVP:**
- Pinecone semantic search (start with SQL filter; swap behind `VectorProvider` interface)
- Networking message generator (one-shot prompt is easy — keep as **stretch goal** for wow factor)
- Skill insights page (table exists, UI later)
- Feedback aggregation & re-ranking
- External job/scholarship APIs (stub `OpportunityProvider`)
- Streaming responses (one-shot first)

---

## 7. Future Roadmap

| Phase | Focus |
|---|---|
| v1.1 | Pinecone-backed semantic match across careers + 1000+ opportunities |
| v1.2 | Networking generator + saved message drafts + send-via-email |
| v1.3 | Skill insights page with curated learning resource graph |
| v1.4 | External provider integrations (job APIs, scholarship feeds, university career centers) |
| v1.5 | Streaming Gemini responses + chat-style follow-ups |
| v1.6 | Calendar + email send integrations; outreach tracking |
| v2.0 | Mobile app, mentor-matching marketplace, employer/program partner side |

---

## 8. Implementation Milestones

Indicative 2-day hackathon timeline. Each milestone ends with a working demo path.

| ID | Goal | Output | Verification |
|---|---|---|---|
| **M0** (2h) | Bootstrap stack | Root `concurrently` ✅, `.env.example`, Neon Auth (Stack) project, Neon DB with `neon_auth.users_sync` provisioned, Pinecone index created, Gemini API key | `npm run dev` boots both services |
| **M1** (4h) | Auth + onboarding | Stack on FE, server-side session verification on BE, Drizzle schema migrated (public schema only), onboarding form persists profile | Sign up → fill form → see profile in DB |
| **M2** (4h) | Career matcher | `POST /api/careers/generate` + careers page, Gemini structured output validated | Click "match me" → see 3-5 cards with fit reasoning |
| **M3** (3h) | Opportunity recommender | Seed ~50 opportunities, `GET /api/opportunities/match`, opportunities page | Filtered, ranked list with eligibility |
| **M4** (3h) | Action plan | `POST /api/action-plans/generate` + page | 7/30/90-day plan rendered |
| **M5** (3h) | Save + settings | Save/unsave, saved page, delete-my-data | Round-trip works |
| **M6** (3h) | Polish + deploy | Loading states, error UX, rate limit, deploy FE+BE | Live URL demoable |
| **M7** (stretch) | Networking generator | One prompt + page | Demo-ready |
| **M8** (stretch) | Pinecone semantic match | Embed seed, swap `OpportunityProvider` to vector-first | Better matches than SQL-only |

**Definition of done (each milestone):** UI usable end-to-end, Zod validation on all AI outputs, no secrets client-side, no destructive operations without confirm.
