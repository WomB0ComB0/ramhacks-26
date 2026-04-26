# Frontend Page & Component Breakdown

> The existing FE is **Vite + React 19 + TypeScript** (already in `frontend/`). Spec said "modern React/Next.js"; for the hackathon we keep Vite (faster ship, no SSR needs). Migrating to Next.js later is mostly route-level work — Stack/Neon Auth + TanStack Query carry over.

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Vite + React 19 (existing) | Fast HMR, no SSR cost; spec ok with React |
| Auth | `@neondatabase/neon-js` (Neon Auth, Better-Auth-based) | Single-DB auth — users in `neon_auth.users_sync` |
| Routing | `react-router-dom` v7 | Simple, works with Vite SPA |
| Data fetching | `@tanstack/react-query` | Cache, retries, optimistic UI |
| Forms | `react-hook-form` + `zod` (`@hookform/resolvers`) | Shared schemas with BE |
| HTTP | `fetch` wrapped with auth header (Stack session token) | No axios needed |
| Styling | Tailwind CSS + shadcn/ui (or Mantine) | Fast, consistent, accessible defaults |
| Icons | `lucide-react` | Tree-shakable |
| Animation | `framer-motion` (page transitions only) | Restraint — no overuse |
| State | TanStack Query for server state; component state via React; `zustand` only if global UI state needed | Keep simple |

---

## 2. Route Map

| Path | Page | Auth | Notes |
|---|---|---|---|
| `/` | `Landing` | public | Hero, value prop, CTAs (sign up / sign in) |
| `/sign-in` | `<AuthView mode="sign-in" />` (from neon-js) | public | |
| `/sign-up` | `<AuthView mode="sign-up" />` | public | |
| `/onboarding` | `Onboarding` | required | Multi-step questionnaire; redirect here if no profile |
| `/dashboard` | `Dashboard` | required | Overview cards: latest career match, top opportunities, current action step |
| `/careers` | `CareerMatches` | required | List + detail drawer |
| `/careers/:id` | `CareerDetail` | required | Full view with skills/projects/growth |
| `/opportunities` | `OpportunityMatches` | required | Filter sidebar + cards |
| `/opportunities/:id` | `OpportunityDetail` | required | Eligibility, steps, deadline, save |
| `/skills` | `SkillInsights` | required | Must/should/nice + resources |
| `/networking` | `NetworkingAssistant` | required | Form → generated message + variants |
| `/action-plan` | `ActionPlan` | required | Tabs: 7d / 30d / 90d / 6mo / long-term |
| `/saved` | `Saved` | required | Tabs: careers, opportunities, messages, plans |
| `/settings` | `Settings` | required | Stack `<AccountSettings />` + delete-my-data |
| `*` | `NotFound` | n/a | |

Auth gate: a `<RequireAuth>` wrapper in `routes/` redirects to `/sign-in` if `useAuth()` reports unsigned; redirects to `/onboarding` if signed in but no profile.

---

## 3. Page Specs

### 3.1 Landing
- Hero: tagline + 1-line value prop + sign-up CTA.
- Three feature cards (Career Match / Opportunities / Action Plan).
- "Built for first-gen students, switchers, and underrepresented talent" pull quote.
- Footer: links to docs/about/contact.

### 3.2 Onboarding
- 4 steps (progress bar, back/next):
  1. **About you**: major, education level, location, remote-ok, experience level.
  2. **Skills & interests**: tag inputs (multi-select with custom add); current skills, interests, target industries.
  3. **Goals & constraints**: career goals (textarea), constraints (schedule, budget, transport, accessibility), preferred work style.
  4. **Review**: summary, "Generate my matches" button.
- On submit → `POST /api/profile`, then navigate `/dashboard`.
- Validate per-step with `zodResolver`; persist draft to `localStorage` so refresh doesn't lose work.

### 3.3 Dashboard
- Top: profile completeness banner if applicable.
- Three cards:
  - **Latest career match** (top 1 with confidence, "see all" link).
  - **Top opportunity for you** (with deadline pill).
  - **Today's action step** (from 7-day plan, mark-done button).
- Quick actions: "Generate fresh matches", "Plan my next 30 days", "Draft an outreach message".

### 3.4 Career Matches
- Header: "Match me" button → `POST /api/careers/generate` (rate-limit aware; show toast on 429).
- Card grid (responsive). Each card: title, fit reason (truncated), confidence bar, difficulty pill, save toggle.
- Click → drawer/route with full detail.
- Empty state: "No matches yet — click Match me to generate."

### 3.5 Career Detail
Sections: title + confidence/difficulty header, fit reason, required skills, missing skills (highlighted with "Learn this" link to skills page), suggested projects, entry roles, growth path, tradeoffs, CTAs (save, generate plan from this, find opportunities for this).

### 3.6 Opportunity Matches
- Filter sidebar: type checkboxes (fellowship / scholarship / bootcamp / mentorship / volunteer / OSS), remote toggle, deadline-within selector, free-only toggle.
- Card list: name, org, type pill, deadline countdown, eligibility tag (Likely / Unclear / Unlikely), save.
- Click → detail.

### 3.7 Opportunity Detail
- Org + type, deadline + countdown.
- "Why this fits you" (AI fitReason).
- Eligibility check explanation.
- Application steps (numbered list with checkmarks user can tick — saves locally).
- WatchOuts.
- External link button (opens in new tab, `rel="noopener noreferrer"`).

### 3.8 Skill Insights
- Three columns (or stacked on mobile): Must-have / Should-have / Nice-to-have.
- Each skill: priority badge, rationale tooltip, "Find resource" expander listing courses/projects.
- Top: "Prioritized order" timeline (1 → N skills).

### 3.9 Networking Assistant
- Form: recipient type select, message type select, tone segmented control, recipient details (name, role, shared connection), ask/goal textarea.
- "Generate" → renders primary draft + 1-3 alternatives + follow-up draft + (for info interview) suggested questions.
- Each draft has "Copy" + "Save". Saved messages live in `/saved`.

### 3.10 Action Plan
- Horizon tabs: 7d / 30d / 90d / 6mo / long-term.
- Each step: checkbox, action title, why expander, time/difficulty pill, success criteria, resource links.
- "Regenerate" button at top with confirmation (replaces current plan; archived in history).
- History list at bottom (read-only previous plans).

### 3.11 Saved
- Tabs: Careers / Opportunities / Messages / Plans.
- Bulk actions: unsave selected.

### 3.12 Settings
- Stack `<AccountSettings />` for account + email + password.
- App-specific section: "Danger zone" with **Delete my profile data** button (confirm modal → `DELETE /api/profile`).
- Pinecone opt-in toggle: "Use vector matching to improve recommendations" (default off until consent).

---

## 4. Shared Components

`components/`:
- `ui/` — shadcn primitives (Button, Card, Input, Select, Tabs, Dialog, Drawer, Toast).
- `Layout.tsx` — top nav with Stack `<UserButton />`, side nav on dashboard pages.
- `RequireAuth.tsx` — guard wrapper.
- `RequireOnboarded.tsx` — guard wrapper.
- `LoadingState.tsx` / `ErrorState.tsx` / `EmptyState.tsx` — consistent fallbacks.
- `ConfidenceBar.tsx` — 0–1 visualization with semantic color (low/med/high).
- `DifficultyPill.tsx`, `EligibilityTag.tsx`, `DeadlineCountdown.tsx`, `TonePicker.tsx`.
- `SkillTagInput.tsx` — multi-select with create-new.
- `SaveButton.tsx` — toggleable bookmark.
- `MarkdownText.tsx` — safe rendering for AI prose using `react-markdown` + `rehype-sanitize`.
- `AISafetyNote.tsx` — small dismissible callout for `safetyNotes`.

`api/`:
- `client.ts` — fetch wrapper that calls `stackApp.getUser()`/Stack session helpers to attach the auth header, plus JSON handling.
- `hooks.ts` — TanStack Query hooks: `useProfile()`, `useGenerateCareers()`, `useOpportunities(filters)`, `useGenerateActionPlan()`, etc.
- `keys.ts` — query key factory (`['careers']`, `['opportunities', filters]`, ...).

---

## 5. Data Loading & Mutations

- **Reads** use `useQuery` with sensible `staleTime` (5min for matches, 1min for action plan).
- **Mutations** use `useMutation` with optimistic updates for save/unsave, and `invalidateQueries` after successful generate/create.
- **AI generation** mutations show a "this may take 5-15s" inline message (not just spinner) — user feels the latency is intentional.
- **Errors**: render `ErrorState` with retry; for `429` show "Slow down — try again in {Retry-After}s"; for `503 ai_unavailable` show "AI is taking a break. Try again in a minute."

---

## 6. Accessibility

- All interactive elements have visible focus and labels.
- Forms use `<label for>` or aria-label; errors associated via `aria-describedby`.
- Color contrast meets WCAG AA.
- Keyboard navigation works on filter sidebar, drawer, and tabs.
- Loading and error states announced via `aria-live="polite"`.

---

## 7. Folder Layout

```
frontend/
  src/
    main.tsx
    App.tsx
    routes/
      index.tsx
      RequireAuth.tsx
      RequireOnboarded.tsx
    pages/
      Landing.tsx
      Onboarding.tsx
      Dashboard.tsx
      Careers.tsx
      CareerDetail.tsx
      Opportunities.tsx
      OpportunityDetail.tsx
      Skills.tsx
      Networking.tsx
      ActionPlan.tsx
      Saved.tsx
      Settings.tsx
      NotFound.tsx
    components/
      ui/...
      Layout.tsx
      ...
    api/
      client.ts
      hooks.ts
      keys.ts
    lib/
      stack.ts
      env.ts
    types/
      api.ts
    styles/
      tailwind.css
```

---

## 8. Env (frontend)

In [.env.example](../.env.example):
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`
