# Security, Privacy & Migration Notes

> Deliverable 9 (security/privacy checklist) plus appendix mapping the existing Mongoose+JWT scaffold to the target Neon Auth (Stack) + Drizzle/Postgres stack.

---

## 1. Threat Model (1-page)

| Asset | Threat | Mitigation |
|---|---|---|
| Stack session token | Theft via XSS, MITM | HttpOnly Stack cookies, HTTPS-only, strict CSP, no innerHTML, sanitize markdown |
| API keys (Gemini, Pinecone, Neon DB URL, Stack secret server key) | Leak via client bundle, logs, repo | Server-side only env, never expose `VITE_*` for secrets, redact in logs, `.env*` gitignored |
| User profile data | Unauthorized read/write, lateral access | Every query scoped by `req.auth.userId` (Stack user id); FKs to `neon_auth.users_sync.id` enforce ownership; no direct ORM access from controllers |
| AI outputs | Hallucinated PII, biased recs, unsafe advice | Zod-validated structured outputs, safety preamble forbids deterministic/discriminatory statements, surfaces `safetyNotes` |
| Vector store | User PII leakage via metadata | Only `updatedAt` in metadata, no name/email; vectors keyed by uuid, not email |
| Cost | Abusive AI calls draining budget | Per-user rate limit on generation routes (6/min), auth required, daily budget cap with circuit breaker |
| Prompt injection | User text in profile manipulating AI | Strip control sequences, fence user content, never expose system prompt to user, no tool-use in MVP |

---

## 2. Security Checklist (build-time)

### Authentication & Authorization
- [ ] Stack server-side `requireAuth()` middleware on all `/api/*` routes except `/api/health`. Uses `@stackframe/stack` Node helpers to verify the session token.
- [ ] Trust only `req.auth.userId` (Stack user id, text). FKs to `neon_auth.users_sync.id` enforce that the user exists; no local `users` table to drift out of sync.
- [ ] All repository queries take a `userId` and `WHERE user_id = $1` (no implicit fan-out).
- [ ] Admin routes gated by Stack role/metadata claim; double-check on every admin handler.

### Input Validation
- [ ] Zod schemas on every body, query, and path parameter.
- [ ] Reject unknown fields (`z.object(...).strict()` where appropriate).
- [ ] Cap free-text fields (`.max(N)`) to prevent prompt-stuffing & token DoS.
- [ ] Use `safe-regex` or static-analyze regex if any user-controlled patterns appear.

### HTTP / Transport
- [ ] `helmet()` middleware (CSP, HSTS, X-Content-Type-Options, frame-ancestors).
- [ ] `cors` allowlist `CORS_ORIGIN` env (no `*`).
- [ ] HTTPS only in production; redirect HTTP→HTTPS at edge.
- [ ] Body size limit `1mb` default, `100kb` on AI generation routes.

### Rate Limiting & Abuse
- [ ] `express-rate-limit` per-user (Stack user id key) for AI routes (6/min) and writes (30/min).
- [ ] Daily AI cost cap with kill-switch env var.
- [ ] Slow-down on auth-fail patterns.
- [ ] Reject deeply-nested JSON or extremely long arrays before validation.

### Secrets & Config
- [ ] All keys server-side; no `process.env.*_SECRET*` in `VITE_*`.
- [ ] `.env.example` committed (no values); `.env` gitignored.
- [ ] Validate env at boot via `zod` (`backend/src/config/env.ts`) — fail fast on missing.
- [ ] Rotate keys quarterly; document rotation procedure.
- [ ] Never log full request bodies on AI routes (PII risk).

### Database
- [ ] Drizzle parameterized queries only (no raw `sql` with template-string user input).
- [ ] Use connection pooling via Neon serverless driver.
- [ ] Migrations reviewed; no destructive ops in CI without confirm step.
- [ ] Backups: rely on Neon point-in-time recovery; document restore procedure.

### AI-Specific
- [ ] Zod-validate every Gemini response before persistence (3 retry attempts, then `503`).
- [ ] Safety preamble in every prompt; reject responses containing deterministic claims.
- [ ] Truncate retrieved-context to a token budget (e.g., ≤ 4k tokens).
- [ ] Log only output IDs and a short summary; not raw user text + raw output.
- [ ] Prompt-injection defense: wrap user-supplied fields in a labeled fence, e.g., `<<<USER_PROFILE>>> ... <<<END>>>`, and instruct the model to treat anything inside as data, not instructions.

### Frontend
- [ ] Sanitize markdown rendering (`rehype-sanitize`); never `dangerouslySetInnerHTML` raw AI text.
- [ ] External links: `rel="noopener noreferrer"` and `target="_blank"`.
- [ ] CSP allows only Stack/Neon Auth origins (`*.stack-auth.com`), the API origin, and self.
- [ ] No secrets in `VITE_*` other than Stack *publishable client* key.

---

## 3. Privacy Commitments

### Data minimization
- Collect only what's needed for matching (major, skills, interests, goals, constraints).
- Do not request: SSN, DOB beyond age-bracket if needed, race/ethnicity, religion, citizenship status, disability status (unless user opts in for eligibility-relevant programs).
- Free-text "constraints" field is user-typed and stored as provided; UI hint asks them to keep it functional, not personal.

### User control
- `DELETE /api/profile` cascades: profile + all AI artifacts (careers, opportunities, skills, action plans, networking messages, feedback) and removes Pinecone vector for `users` namespace.
- Settings page exposes the delete button and a Pinecone opt-in toggle.

### Anti-discrimination
- Prompt explicitly forbids inferring protected characteristics.
- Recommendations must cite user-provided fields, never inferences.
- Manual audit of seed corpus to remove programs with discriminatory eligibility (e.g., based on protected class) unless legally permitted (e.g., specific scholarships for underrepresented groups, which the user opts into seeing).

### Logging
- Structured logs (pino or similar): `{ ts, route, userId, status, latencyMs, costEstUsd }`.
- AI logs: store the **schema-validated output ID** + token counts, not raw prompts/outputs.
- No request-body logging on `/api/profile`, `/api/networking/*`, `/api/skills/*`.

### Retention
- Profile + recommendations: as long as user keeps account.
- On account delete: Stack soft-deletes the row in `neon_auth.users_sync` (sets `deleted_at`); a daily job (or Stack webhook) hard-deletes app data + Pinecone vector within 24h. ON DELETE CASCADE on every FK ensures children go when the row is removed.
- Audit logs: 90 days.

---

## 4. AI Output Safety Rules

Enforced via prompt + post-validation:
- Reject response if it contains regex-detected deterministic phrases ("you will definitely", "guaranteed", "100% chance").
- Reject if it mentions a protected characteristic the user didn't supply.
- Always render `safetyNotes` (when present) prominently in UI as a small callout.
- Cap confidence score: if Gemini reports `confidence > 0.9` without strong evidence in user profile, server clamps to `0.85` and adds a safetyNote.

---

## 5. Stack Migration Appendix

### Current state (existing scaffold)
```
backend/src/
  index.ts                       # express bootstrap, mongoose connect
  models/Account.ts              # mongoose schema
  routes/auth.ts                 # /signup, /login
  controllers/auth/              # signup/login handlers
  middlewares/check-bearer-token.ts  # custom JWT verify
  middlewares/error-handler.ts
  utils/mongo.ts                 # mongoose connect
  utils/crypt.ts                 # bcrypt wrapper
  utils/jwt.ts                   # jsonwebtoken wrapper
  utils/joi.ts                   # joi validation
  utils/app.ts
backend/package.json deps:
  bcrypt, cors, dotenv, express, joi, jsonwebtoken, mongoose
```

### Target state
```
backend/src/
  index.ts                       # bootstrap (kept, rewired)
  server.ts                      # express app config (helmet, cors, rate limit)
  config/env.ts                  # zod-validated env
  middleware/auth.ts             # @stackframe/stack server SDK — verify Stack session
  middleware/errorHandler.ts
  middleware/rateLimit.ts
  db/
    schema.ts                    # Drizzle (created in this design batch)
    client.ts                    # Neon serverless + drizzle()
    migrations/                  # drizzle-kit output
  routes/
    profile.ts
    careers.ts
    opportunities.ts
    skills.ts
    networking.ts
    actionPlans.ts
    feedback.ts
  services/
    ai/{provider,gemini,run,prompts/*,schemas}.ts
    vector/{provider,pinecone}.ts
    embeddings/{provider,gemini}.ts
    opportunities/{provider,seed}.ts
  repositories/{users,profiles,careers,opportunities,skills,plans,messages,feedback}.ts
  pipeline/{profileSummary,generateCareers,matchOpportunities,generateActionPlan}.ts
  types/api.ts
backend/package.json deps:
  add: @stackframe/stack, drizzle-orm, drizzle-kit, postgres, @neondatabase/serverless,
       @pinecone-database/pinecone, @google/generative-ai, zod, helmet,
       express-rate-limit, pino, pino-http
  remove (after cutover): bcrypt, jsonwebtoken, mongoose, joi, @types/bcrypt, @types/jsonwebtoken
  keep: cors, dotenv, express
```

### Migration steps (recommended)

1. **Bootstrap target stack alongside existing** (low risk):
   - `backend/src/db/schema.ts` (added in this batch).
   - Add new deps (do not remove old yet).
   - Add `drizzle.config.ts`.
   - Create Neon DB, run first migration.

2. **Replace auth** (single PR):
   - Enable Neon Auth in the Neon dashboard (provisions `neon_auth.users_sync`).
   - Add `@stackframe/stack` (server + client) and wire a `requireAuth()` middleware that verifies the Stack session token.
   - Replace `check-bearer-token.ts` calls with the new middleware.
   - Delete `routes/auth.ts`, `controllers/auth/`, `utils/jwt.ts`, `utils/crypt.ts`, `models/Account.ts`, `utils/mongo.ts`.
   - Drop `bcrypt`, `jsonwebtoken`, `mongoose` from deps.

3. **Build feature routes** behind Stack auth: profile → careers → opportunities → action plan → networking → feedback.

4. **Add Pinecone** when ready (post-MVP) — wire `VectorProvider` into opportunity matching pipeline.

5. **Telemetry** — pino logs + a simple `costEstUsd` counter for AI.

### Rollback
Until step 2 ships, the legacy auth still works. Feature flag the new Stack auth via env (`AUTH_PROVIDER=stack|legacy`) if you need a soft rollout.

---

## 6. Compliance & Disclaimers

- Show a footer/about page disclaimer: "Career suggestions are AI-generated, not professional advice. Verify eligibility and details with each program."
- Include a Privacy Policy and ToS before public launch (out of MVP scope but block the share button until they exist).
- If targeting EU/UK users: GDPR data export (`GET /api/profile/export`) and right-to-be-forgotten (already covered by delete).
- If targeting children under 13: COPPA — out of scope for MVP; add age gate.
