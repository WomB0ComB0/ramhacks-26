import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

interface Resource {
  label: string;
  url?: string;
}

interface ActionStep {
  action: string;
  why: string;
  estTimeHours: number;
  difficulty: "easy" | "moderate" | "hard";
  expectedOutcome: string;
  successCriteria: string;
  resources?: Resource[];
  done?: boolean;
}

interface PlanRow {
  id: string;
  userId: string;
  summary: string | null;
  confidence: number;
  sevenDayPlan: ActionStep[];
  thirtyDayPlan: ActionStep[];
  ninetyDayPlan: ActionStep[];
  sixMonthPlan: ActionStep[];
  longTermPlan: ActionStep[];
  anchorCareerId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GenerateResponse {
  summary: string;
  confidence: number;
  safetyNotes?: string;
  plan: PlanRow;
}

type Horizon = "sevenDayPlan" | "thirtyDayPlan" | "ninetyDayPlan" | "sixMonthPlan" | "longTermPlan";

const HORIZONS: ReadonlyArray<{ key: Horizon; label: string }> = [
  { key: "sevenDayPlan", label: "7 days" },
  { key: "thirtyDayPlan", label: "30 days" },
  { key: "ninetyDayPlan", label: "90 days" },
  { key: "sixMonthPlan", label: "6 months" },
  { key: "longTermPlan", label: "Long-term" },
];

function DifficultyPill({ value }: { value: ActionStep["difficulty"] }) {
  const colors: Record<ActionStep["difficulty"], string> = {
    easy: "#34d399",
    moderate: "#fbbf24",
    hard: "#fb7185",
  };
  return (
    <span className="kbd" style={{ color: colors[value] }}>
      {value}
    </span>
  );
}

function StepCard({ step, index }: { step: ActionStep; index: number }) {
  const [done, setDone] = useState(step.done ?? false);
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className="card-muted"
      style={{
        marginBottom: 10,
        opacity: done ? 0.6 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
          style={{ marginTop: 4, cursor: "pointer" }}
          aria-label={`Mark step ${index + 1} done`}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <strong
              style={{
                color: "var(--text-strong)",
                textDecoration: done ? "line-through" : "none",
                fontSize: 14,
              }}
            >
              {step.action}
            </strong>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <span className="kbd">{step.estTimeHours}h</span>
              <DifficultyPill value={step.difficulty} />
            </div>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 6,
              padding: 0,
              background: "transparent",
              border: 0,
              color: "var(--text-muted)",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {expanded ? "Hide details" : "Why & success criteria"}
          </button>
          {expanded && (
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--text)" }}>
              <p style={{ margin: "0 0 6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Why: </span>
                {step.why}
              </p>
              <p style={{ margin: "0 0 6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Outcome: </span>
                {step.expectedOutcome}
              </p>
              <p style={{ margin: "0 0 6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Success: </span>
                {step.successCriteria}
              </p>
              {step.resources && step.resources.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Resources: </span>
                  {step.resources.map((r, i) => (
                    <span key={i} style={{ marginRight: 8 }}>
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer">
                          {r.label}
                        </a>
                      ) : (
                        r.label
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ActionPlanPanel() {
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<Horizon>("sevenDayPlan");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ plan: PlanRow | null }>("/api/action-plans/latest");
        if (!cancelled) setPlan(res.plan);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : String(e);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post<GenerateResponse>("/api/action-plans/generate", {});
      setPlan(res.plan);
      setHorizon("sevenDayPlan");
    } catch (e) {
      const detail =
        e instanceof ApiError
          ? `${e.status} ${e.code}: ${e.message}` +
            (e.details
              ? `\n\n${typeof e.details === "string" ? e.details : JSON.stringify(e.details, null, 2)}`
              : "")
          : String(e);
      setError(detail);
    } finally {
      setGenerating(false);
    }
  };

  const steps = plan ? plan[horizon] : [];

  return (
    <section style={{ marginTop: 32 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Action plan</h2>
        <button
          className="btn btn-primary"
          onClick={generate}
          disabled={generating}
          style={{ minWidth: 140 }}
        >
          {generating ? "Planning…" : plan ? "Regenerate" : "Plan my next steps"}
        </button>
      </header>

      {error && <pre className="pre-err">{error}</pre>}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : !plan ? (
        <div className="card-muted" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            No plan yet. Click <strong>Plan my next steps</strong> to generate one.
          </p>
        </div>
      ) : (
        <>
          {plan.summary && (
            <div className="card-muted" style={{ marginBottom: 12 }}>
              <p style={{ margin: 0, color: "var(--text)" }}>{plan.summary}</p>
            </div>
          )}

          <div className="seg" role="tablist" style={{ marginBottom: 14 }}>
            {HORIZONS.map((h) => (
              <button
                key={h.key}
                role="tab"
                aria-selected={horizon === h.key}
                onClick={() => setHorizon(h.key)}
              >
                {h.label} ({plan[h.key].length})
              </button>
            ))}
          </div>

          {steps.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No steps in this horizon.</p>
          ) : (
            <div>
              {steps.map((s, i) => (
                <StepCard key={i} step={s} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
