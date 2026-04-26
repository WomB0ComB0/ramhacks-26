# AI Career & Opportunity Matcher

Personalized career-discovery platform for students, career switchers, and underrepresented talent. Profile in → AI-personalized career matches + a 7d/30d/90d/6mo/long-term action plan out.

> Built for **RamHacks 2026**. Live demo: _add link after deploy_.

**Stack:** Vite + React 19 (frontend) · Express + TypeScript (backend) · Neon Postgres + Drizzle ORM · Neon Auth (Better-Auth based, JWT) · Google Gemini (career matcher + action plan) · Pinecone (planned for v1.1).

Design docs in [`docs/`](./docs): [SPEC](./docs/SPEC.md) · [API](./docs/API.md) · [AI](./docs/AI.md) · [FRONTEND](./docs/FRONTEND.md) · [SECURITY](./docs/SECURITY.md).

---

## Local development

### Prerequisites

- Node 20+ (tested on 25.x)
- A **Neon** project with **Auth enabled** (provisions `neon_auth.session`, `neon_auth.user`, `neon_auth.jwks`)
- A **Gemini API key** ([aistudio.google.com](https://aistudio.google.com))
- (Optional, for v1.1) A **Pinecone** account + serverless index `careers-mvp`, dim 1024, cosine

### Setup

```bash
git clone <this-repo>
cd ramhacks-26

# Install all workspaces
npm run install:all

# Copy env template and fill in
cp .env.example .env
# edit .env with DATABASE_URL, VITE_NEON_AUTH_URL, GEMINI_API_KEY, etc.

# Apply schema to your Neon DB (creates 7 tables in public schema)
cd backend && npm run db:push && cd ..

# Start both backend (port 4000) and frontend (port 5173)
npm run dev
```

Open `http://localhost:5173`. Sign up → fill onboarding form → click **Match me** → click **Plan my next steps**.

### Useful npm scripts (from repo root)

- `npm run dev` — backend + frontend in parallel via concurrently
- `npm run build` — both production builds
- `npm run start` — both production servers
- `cd backend && npm run db:generate -- --name <name>` — generate a new Drizzle migration
- `cd backend && npm run db:push` — apply pending migrations to Neon
- `cd backend && npm run db:studio` — open Drizzle Studio in browser

---

## Deploy

Two services. **Railway** for the backend (no cold starts, ~30s deploys), **Vercel** for the frontend.

> Render's free tier sleeps after 15 min of inactivity → 30–60 s wake-up on first request, which kills the demo feel. Use Railway for the hackathon. `render.yaml` is included as a fallback if you exhaust your Railway trial.

### 1. Backend → Railway (recommended)

1. Push the repo to GitHub.
2. https://railway.com/new → **Deploy from GitHub repo** → pick this repo.
3. Railway detects `backend/railway.json` and the Node project. Set **Root directory** to `backend` in the service settings (Settings → Source).
4. **Variables** tab → add:

   | Var | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` *(Railway will inject its own — leaving this set is harmless)* |
   | `LOG_LEVEL` | `info` |
   | `AI_DAILY_BUDGET_USD` | `10` |
   | `DATABASE_URL` | Neon pooled connection string |
   | `VITE_NEON_AUTH_URL` | from Neon Console → Auth tab |
   | `GEMINI_API_KEY` | from aistudio.google.com |
   | `GEMINI_MODEL` | `gemini-2.5-flash` (or blank — auto-discovery picks one) |
   | `GEMINI_EMBED_MODEL` | `text-embedding-004` |
   | `PINECONE_API_KEY` | from app.pinecone.io *(optional for MVP)* |
   | `PINECONE_INDEX` | `careers-mvp` |
   | `CORS_ORIGIN` | leave blank for now — set after Vercel deploy |

5. Settings → **Networking → Generate Domain**. You get something like `ramhacks-backend-production.up.railway.app`.
6. Deploys are auto on every push to main. ~30 s build.

### 1b. Backend alternatives

| Host | Config in repo | Pros | Cons |
|---|---|---|---|
| **Railway** *(recommended)* | `backend/railway.json` | No cold starts on trial, fast, simple env UI | $5 free / month then paid |
| **Render** | `backend/render.yaml` | True free tier | Cold starts (30–60 s) on free |
| **Fly.io** | none yet — `fly launch` from `backend/` autogen | Global edge, fast cold start | Slightly more setup; needs `fly.toml` |
| **Koyeb** | none | Generous free, fast | Smaller ecosystem |
| **Vercel (serverless)** | not set up | Same host as frontend | Express needs adapter; cold starts; long-running AI calls hit timeout |

### 2. Frontend → Vercel

1. https://vercel.com/new → import the same GitHub repo.
2. **Root directory**: `frontend`. Vercel auto-detects Vite + reads `frontend/vercel.json` for the SPA rewrite.
3. **Environment variables** (Settings → Environment Variables):

   | Var | Value |
   |---|---|
   | `VITE_NEON_AUTH_URL` | same value as the backend |
   | `VITE_API_BASE_URL` | your backend URL from step 1.5 (e.g. `https://ramhacks-backend-production.up.railway.app`) |

4. Deploy. First build ~1 minute. You'll get a URL like `https://ramhacks-26.vercel.app`.

### 3. Wire CORS

In your backend host's environment settings (Railway → Variables, or Render → Environment), set `CORS_ORIGIN` to your Vercel URL (no trailing slash):

```
CORS_ORIGIN=https://ramhacks-26.vercel.app
```

Save. The host auto-redeploys.

### 4. Smoke-test prod

Replace `<BACKEND>` with your Railway/Render URL:

```bash
# Health
curl https://<BACKEND>/api/health
# expect: {"ok":true,"ts":"2026-..."}

# Auth required (no token → 401, not 404)
curl -i https://<BACKEND>/api/profile
```

Sign up on the live site, click **Match me**, click **Plan my next steps**. Done.

---

## Project layout

```
ramhacks-26/
├── backend/                # Express + Drizzle
│   ├── src/
│   │   ├── db/             # schema.ts, client.ts
│   │   ├── middleware/     # auth.ts (Neon Auth session lookup)
│   │   ├── routes/         # profile.ts, careers.ts, actionPlans.ts
│   │   ├── repositories/   # profiles.ts, careers.ts, plans.ts
│   │   ├── services/ai/    # gemini.ts + prompts/ + schemas.ts
│   │   ├── server.ts       # Express bootstrap
│   │   ├── load-env.ts     # reads ../.env at startup
│   │   └── index.ts        # entry point
│   ├── drizzle/            # generated SQL migrations
│   ├── drizzle.config.ts
│   ├── render.yaml         # Render IaC
│   └── package.json
├── frontend/               # Vite + React 19
│   ├── src/
│   │   ├── components/     # OnboardingForm, CareerMatches, ActionPlanPanel
│   │   ├── api/client.ts   # fetch wrapper with auth header
│   │   ├── lib/auth.ts     # @neondatabase/neon-js client
│   │   ├── App.tsx         # route gate
│   │   └── main.tsx        # NeonAuthUIProvider + QueryClientProvider
│   ├── vercel.json
│   └── package.json
├── docs/                   # design docs (SPEC/API/AI/FRONTEND/SECURITY)
├── .env.example            # template — copy to .env
└── package.json            # root: concurrently runs both apps
```

---

## License

Apache-2.0 — see [LICENSE](./LICENSE) (add before public release).

🤖 Built with help from Claude Code.
