# API Route Plan

> REST contract for the Express backend. All routes are JSON over HTTPS.
> Mounted at `/api`. Versioning via path (`/api/v1/...`) deferred until first breaking change.

## Conventions

- **Auth**: Every route except `GET /api/health` requires a Neon Auth (Stack) session. A `requireAuth()` middleware verifies the Stack session token and populates `req.auth.userId` with the Stack user id (text). All app tables FK directly against `neon_auth.users_sync.id`, so no local `users` row sync is needed — JOINs work natively.
- **Validation**: All request bodies validated with Zod schemas (shared between FE/BE via `backend/src/types/api.ts`).
- **Errors**: `{ error: { code: string, message: string, details?: unknown } }` with HTTP status. Codes: `unauthorized`, `forbidden`, `not_found`, `validation_failed`, `rate_limited`, `ai_unavailable`, `internal`.
- **Rate limits** (per user): writes `30/min`, AI generation routes `6/min`, reads `120/min`. Returns `429` with `Retry-After`.
- **IDs**: UUID v4 unless otherwise noted.
- **Pagination**: `?cursor=<opaque>&limit=20` (default 20, max 100). Response includes `nextCursor`.

---

## Health & Meta

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | Liveness probe — `{ ok: true, ts }` |
| GET | `/api/me` | yes | Returns local user + profile if exists |

---

## Profile

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/api/profile` | yes | Get current user profile (or 404 if not onboarded) |
| POST | `/api/profile` | yes | Create profile (onboarding) |
| PATCH | `/api/profile` | yes | Update profile fields |
| DELETE | `/api/profile` | yes | Soft-delete profile + cascade clear AI artifacts |

**`POST /api/profile` body**
```json
{
  "major": "Computer Science",
  "educationLevel": "undergraduate",
  "location": { "country": "US", "region": "FL", "remoteOk": true },
  "experienceLevel": "entry",
  "interests": ["ml", "education", "social impact"],
  "currentSkills": ["python", "react", "sql"],
  "targetIndustries": ["edtech", "nonprofit", "health"],
  "careerGoals": "Use ML to improve education access",
  "constraints": { "schedule": "part-time", "budget": "low", "transport": "remote-only" },
  "preferredWorkStyle": ["async", "small-team"]
}
```

**Response**: `201` with `{ profile: {...}, userId }`.

---

## Career Matcher

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/careers/generate` | yes | Generate fresh career recommendations (AI call, rate-limited) |
| GET  | `/api/careers` | yes | List user's recommendations (paginated) |
| GET  | `/api/careers/:id` | yes | Get one recommendation |
| POST | `/api/careers/:id/save` | yes | Save / unsave |
| DELETE | `/api/careers/:id` | yes | Delete one |

**`POST /api/careers/generate` body** (optional refinements)
```json
{ "limit": 5, "focus": "ml-for-education", "excludeIds": [] }
```

**Response** (matches `CareerMatch[]` schema in [AI.md](./AI.md)):
```json
{
  "recommendations": [
    {
      "id": "...",
      "title": "ML Engineer (EdTech focus)",
      "fitReason": "...",
      "requiredSkills": ["python","pytorch","statistics"],
      "missingSkills": ["pytorch","statistics"],
      "suggestedProjects": [{ "name": "...", "outline": "..." }],
      "entryRoles": ["ML intern", "Junior data scientist"],
      "growthPath": ["MLE → Senior MLE → Staff ML Researcher"],
      "difficulty": "moderate",
      "confidence": 0.78,
      "tradeoffs": "..."
    }
  ],
  "summary": "...",
  "safetyNotes": "..."
}
```

---

## Opportunity Recommender

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/api/opportunities/match` | yes | Recommend opportunities for current profile (filter + rank) |
| GET  | `/api/opportunities/:id` | yes | Detail |
| POST | `/api/opportunities/:id/save` | yes | Save / unsave |
| GET  | `/api/opportunities/saved` | yes | List saved |

**`GET /api/opportunities/match` query**
```
?type=fellowship,scholarship,bootcamp&remote=true&deadlineWithinDays=60&limit=20
```

Returns `OpportunityMatch[]` (see [AI.md](./AI.md)). Server pipeline: filter static seed → optional Pinecone re-rank → Gemini "fitReason" enrichment for top N.

---

## Skill Insights

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/skills/analyze` | yes | Generate skill insight (AI) for current profile |
| GET  | `/api/skills/latest` | yes | Latest cached insight |

Response shape: `SkillInsight` from [AI.md](./AI.md).

---

## Networking Assistant

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/networking/generate` | yes | Generate outreach message |
| GET  | `/api/networking/messages` | yes | List user's message history |
| DELETE | `/api/networking/messages/:id` | yes | Delete |

**`POST /api/networking/generate` body**
```json
{
  "recipientType": "alumni|recruiter|mentor|professor|founder",
  "messageType": "linkedin_intro|email_intro|follow_up|info_interview|mentor_request",
  "tone": "professional|casual|warm|confident|student|founder",
  "context": {
    "recipientName": "Jane Doe",
    "recipientRole": "Senior MLE at Company",
    "sharedConnection": "Both attended UF",
    "askOrGoal": "20-minute info interview about transitioning into MLE"
  }
}
```

---

## Action Plan

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/action-plans/generate` | yes | Generate plan (AI) |
| GET  | `/api/action-plans/latest` | yes | Latest plan |
| GET  | `/api/action-plans` | yes | History (paginated) |
| GET  | `/api/action-plans/:id` | yes | Detail |
| PATCH | `/api/action-plans/:id` | yes | Mark steps complete |

**`POST /api/action-plans/generate` body** (optional)
```json
{ "horizon": "90d", "anchorCareerId": "uuid-of-saved-career" }
```

---

## Feedback

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/feedback` | yes | Submit feedback on any recommendation/message/plan |

```json
{
  "targetType": "career|opportunity|networking|action_plan|skill_insight",
  "targetId": "uuid",
  "rating": 1,
  "comment": "Optional"
}
```

---

## Internal/Admin (gated, optional)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/admin/opportunities/seed` | admin | Re-seed opportunity corpus |
| POST | `/api/admin/embeddings/rebuild` | admin | Re-embed corpora and upsert to Pinecone |

Admin gate via Stack role/metadata claim; **never** exposed without explicit role check.
