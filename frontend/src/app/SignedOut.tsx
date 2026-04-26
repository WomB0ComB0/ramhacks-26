import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthView } from "@neondatabase/neon-js/auth/react/ui";
import Brand from "./Brand";

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

export default function SignedOut() {
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
            <h1 className="hero-headline">Find a path that actually fits.</h1>
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
