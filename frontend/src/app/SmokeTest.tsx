import { useState } from "react";
import { api, ApiError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";

// Dev-only API smoke test. Hidden behind ?debug=1 in production.
export default function SmokeTest() {
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
