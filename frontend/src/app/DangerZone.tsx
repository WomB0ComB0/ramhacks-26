import { useState } from "react";
import { api, ApiError } from "../api/client";
import { signOut } from "../lib/auth";
import ErrorBanner from "../components/ErrorBanner";

export default function DangerZone() {
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
