import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthView, AccountView } from "@neondatabase/neon-js/auth/react/ui";
import { useSession, signOut } from "./lib/auth";
import { api, ApiError } from "./api/client";
import OnboardingForm from "./components/OnboardingForm";
import CareerMatches from "./components/CareerMatches";
import ActionPlanPanel from "./components/ActionPlanPanel";
import OpportunityList from "./components/OpportunityList";
import ErrorBanner from "./components/ErrorBanner";

// M1 smoke-test UI. Real pages (Onboarding, Dashboard, etc.) will replace this.

type AuthMode = "sign-up" | "sign-in" | "forgot-password";

const MODES: ReadonlyArray<{ key: AuthMode; label: string }> = [
  { key: "sign-up", label: "Sign up" },
  { key: "sign-in", label: "Sign in" },
  { key: "forgot-password", label: "Reset" },
];

const KNOWN_MODES = new Set<AuthMode>(MODES.map((m) => m.key));

function modeFromPath(pathname: string): AuthMode {
  const seg = pathname.replace(/^\/auth\//, "").split("/")[0];
  return KNOWN_MODES.has(seg as AuthMode) ? (seg as AuthMode) : "sign-up";
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "linear-gradient(135deg, #a78bfa, #6366f1)",
          boxShadow: "0 6px 20px rgba(167, 139, 250, 0.35)",
        }}
      />
      <span style={{ fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)" }}>
        AI Career Matcher
      </span>
    </div>
  );
}

function SignedOut() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = modeFromPath(location.pathname);

  // Keep URL under /auth/{mode} so AuthView's internal nav and our tabs
  // both read from the same source of truth.
  useEffect(() => {
    if (!location.pathname.startsWith("/auth/")) {
      navigate(`/auth/${mode}`, { replace: true });
    }
  }, [location.pathname, mode, navigate]);

  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "20px 24px" }}>
        <Brand />
      </header>

      <main
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "24px 16px 64px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1>Find a path that actually fits.</h1>
            <p style={{ color: "var(--text-muted)", marginTop: 10 }}>
              Career matches, fellowships, and an action plan—personalized, not generic.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div className="seg" role="tablist">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={mode === m.key}
                  onClick={() => navigate(`/auth/${m.key}`)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <AuthView pathname={mode} />
          </div>

          <p
            style={{
              textAlign: "center",
              marginTop: 16,
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            By continuing you agree to the demo terms. Career suggestions are AI-generated and not professional advice.
          </p>
        </div>
      </main>
    </div>
  );
}

function SmokeTest() {
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ping = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.get("/api/profile");
      setResult(data);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`${e.status} ${e.code} — ${e.message}`);
        if (e.status === 404) setResult({ note: "no profile yet — that's expected" });
      } else {
        setError(String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>API smoke test</h2>
        <span className="kbd">GET /api/profile</span>
      </div>
      <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
        Round-trips the Stack JWT to Express, verifies via JWKS, and reads from Neon via Drizzle.
        A 404 here is the expected happy path before onboarding.
      </p>
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary" onClick={ping} disabled={loading}>
          {loading ? "Calling…" : "Run smoke test"}
        </button>
      </div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {result !== null && <pre className="pre-ok">{JSON.stringify(result, null, 2)}</pre>}
    </section>
  );
}

interface ProfileRow {
  id: string;
  userId: string;
  major: string | null;
  educationLevel: string | null;
  experienceLevel: string | null;
  interests: string[];
  currentSkills: string[];
  targetIndustries: string[];
  careerGoals: string | null;
  createdAt: string;
}

type ProfileState =
  | { kind: "loading" }
  | { kind: "absent" }
  | { kind: "ready"; profile: ProfileRow }
  | { kind: "error"; message: string };

function useProfile() {
  const [state, setState] = useState<ProfileState>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const data = await api.get<{ profile: ProfileRow }>("/api/profile");
        if (!cancelled) setState({ kind: "ready", profile: data.profile });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setState({ kind: "absent" });
        } else if (e instanceof ApiError) {
          setState({ kind: "error", message: `${e.status} ${e.code}: ${e.message}` });
        } else {
          setState({ kind: "error", message: String(e) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { state, refetch: () => setVersion((v) => v + 1) };
}

function ProfileSummary({ profile }: { profile: ProfileRow }) {
  const tags = (xs: string[]) =>
    xs.length === 0 ? (
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
    ) : (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {xs.map((x) => (
          <span key={x} className="kbd">
            {x}
          </span>
        ))}
      </div>
    );

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>Your profile</h2>
        <span className="kbd">{profile.major ?? "—"}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "120px 1fr",
          gap: "10px 16px",
          marginTop: 14,
          fontSize: 14,
        }}
      >
        <div style={{ color: "var(--text-muted)" }}>Education</div>
        <div>{profile.educationLevel ?? "—"}</div>
        <div style={{ color: "var(--text-muted)" }}>Experience</div>
        <div>{profile.experienceLevel ?? "—"}</div>
        <div style={{ color: "var(--text-muted)" }}>Interests</div>
        <div>{tags(profile.interests)}</div>
        <div style={{ color: "var(--text-muted)" }}>Skills</div>
        <div>{tags(profile.currentSkills)}</div>
        <div style={{ color: "var(--text-muted)" }}>Industries</div>
        <div>{tags(profile.targetIndustries)}</div>
        <div style={{ color: "var(--text-muted)" }}>Goals</div>
        <div>{profile.careerGoals ?? "—"}</div>
      </div>
    </section>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wipe = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.delete("/api/me");
      await signOut();
      // signOut redirects via auth client; if it doesn't, force it.
      window.location.href = "/";
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
      setBusy(false);
    }
  };

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ color: "#fb7185" }}>Danger zone</h2>
      <div className="card-muted" style={{ marginTop: 8, borderColor: "#fb7185" }}>
        <p style={{ margin: 0, color: "var(--text)" }}>
          Delete your profile, career matches, saved opportunities, and action plans. Your
          sign-in account stays so you can re-onboard, or use the Account section above to
          remove the account itself.
        </p>
        {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!confirming ? (
            <button
              className="btn"
              style={{ borderColor: "#fb7185", color: "#fb7185" }}
              onClick={() => setConfirming(true)}
            >
              Delete my data
            </button>
          ) : (
            <>
              <button
                className="btn"
                style={{ background: "#fb7185", borderColor: "#fb7185", color: "#fff" }}
                onClick={wipe}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Yes, delete everything"}
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SignedIn({ user }: { user: { id: string; email: string; name?: string } }) {
  const { state, refetch } = useProfile();

  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Brand />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{user.email}</span>
          <button className="btn btn-ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ width: "100%", maxWidth: 880, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ marginBottom: 8 }}>Welcome{user.name ? `, ${user.name}` : ""}.</h1>
        <p style={{ color: "var(--text-muted)" }}>
          <span className="kbd">userId</span>{" "}
          <span style={{ marginLeft: 6, fontFamily: "ui-monospace, Menlo", fontSize: 12 }}>
            {user.id}
          </span>
        </p>

        {state.kind === "loading" && (
          <p style={{ color: "var(--text-muted)", marginTop: 24 }}>Loading profile…</p>
        )}

        {state.kind === "error" && <ErrorBanner message={state.message} />}

        {state.kind === "absent" && <OnboardingForm onSaved={refetch} />}

        {state.kind === "ready" && (
          <>
            <ProfileSummary profile={state.profile} />
            <CareerMatches />
            <OpportunityList />
            <ActionPlanPanel />
          </>
        )}

        {new URLSearchParams(window.location.search).get("debug") === "1" && <SmokeTest />}

        <section style={{ marginTop: 32 }}>
          <h2>Account</h2>
          <div className="card-muted" style={{ marginTop: 8 }}>
            <AccountView />
          </div>
        </section>

        <DangerZone />
      </main>
    </div>
  );
}

function App() {
  const session = useSession();

  if (session.isPending) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100svh" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!session.data?.user) {
    return <SignedOut />;
  }

  return <SignedIn user={session.data.user} />;
}

export default App;
