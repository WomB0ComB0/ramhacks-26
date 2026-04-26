import { useEffect, useState } from "react";
import { api, ApiError } from "@/api/client";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { SkeletonGrid } from "@/components/ui/Skeleton";

interface SuggestedProject {
  name: string;
  outline: string;
  estTimeWeeks?: number;
}

interface CareerRow {
  id: string;
  userId: string;
  title: string;
  fitReason: string;
  requiredSkills: string[];
  missingSkills: string[];
  suggestedProjects: SuggestedProject[];
  entryRoles: string[];
  growthPath: string[];
  confidenceScore: number;
  difficulty: string;
  tradeoffs: string | null;
  aiExplanation: string | null;
  saved: boolean;
  createdAt: string;
}

interface GenerateResponse {
  summary: string;
  reasoning: string;
  confidence: number;
  nextSteps: string[];
  safetyNotes?: string;
  recommendations: CareerRow[];
}

interface ListResponse {
  recommendations: CareerRow[];
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const fillClass =
    value >= 0.7 ? "confidence-fill-high" : value >= 0.45 ? "confidence-fill-mid" : "confidence-fill-low";
  return (
    <div title={`confidence ${pct}%`} className="confidence-track">
      <div className={`confidence-fill ${fillClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DifficultyPill({ value }: { value: string }) {
  const labels: Record<string, string> = {
    easy: "easy",
    moderate: "moderate",
    hard: "hard",
    very_hard: "very hard",
  };
  const tint =
    value === "easy"
      ? "tint-success"
      : value === "moderate"
        ? "tint-accent2"
        : value === "hard"
          ? "tint-warning"
          : value === "very_hard"
            ? "tint-danger"
            : "";
  return <span className={`kbd ${tint}`}>{labels[value] ?? value}</span>;
}

function CareerCard({
  row,
  onSaveToggle,
}: {
  row: CareerRow;
  onSaveToggle: (id: string, saved: boolean) => void;
}) {
  return (
    <article className="card card-hoverable" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            color: "var(--text-strong)",
            letterSpacing: "-0.01em",
          }}
        >
          {row.title}
        </h3>
        <button
          className="btn"
          style={{
            padding: "6px 10px",
            fontSize: 12,
            background: row.saved ? "var(--accent-soft)" : undefined,
            borderColor: row.saved ? "var(--accent)" : undefined,
          }}
          onClick={() => onSaveToggle(row.id, !row.saved)}
        >
          {row.saved ? "★ Saved" : "☆ Save"}
        </button>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ConfidenceBar value={row.confidenceScore} />
        <DifficultyPill value={row.difficulty} />
      </div>

      <p style={{ color: "var(--text)", fontSize: 14, margin: 0 }}>{row.fitReason}</p>

      {row.missingSkills.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Skills to build
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {row.missingSkills.map((s) => (
              <span key={s} className="kbd tint-warning">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {row.suggestedProjects.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Suggested projects
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text)", fontSize: 13 }}>
            {row.suggestedProjects.map((p, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong style={{ color: "var(--text-strong)" }}>{p.name}</strong>
                {p.estTimeWeeks ? (
                  <span style={{ color: "var(--text-muted)" }}> · {p.estTimeWeeks}w</span>
                ) : null}
                <br />
                <span style={{ color: "var(--text-muted)" }}>{p.outline}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {row.entryRoles.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Entry roles
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {row.entryRoles.map((r) => (
              <span key={r} className="kbd">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {row.tradeoffs && (
        <details style={{ fontSize: 13, color: "var(--text-muted)" }}>
          <summary style={{ cursor: "pointer" }}>Tradeoffs</summary>
          <p style={{ marginTop: 6 }}>{row.tradeoffs}</p>
        </details>
      )}
    </article>
  );
}

export default function CareerMatches() {
  const [list, setList] = useState<CareerRow[]>([]);
  const [meta, setMeta] = useState<Pick<
    GenerateResponse,
    "summary" | "reasoning" | "confidence" | "nextSteps" | "safetyNotes"
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ListResponse>("/api/careers");
        if (!cancelled) setList(res.recommendations);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post<GenerateResponse>("/api/careers/generate", {});
      setList((prev) => [...res.recommendations, ...prev]);
      setMeta({
        summary: res.summary,
        reasoning: res.reasoning,
        confidence: res.confidence,
        nextSteps: res.nextSteps,
        safetyNotes: res.safetyNotes,
      });
    } catch (e) {
      const detail =
        e instanceof ApiError
          ? `${e.status} ${e.code}: ${e.message}` +
            (e.details ? `\n\n${typeof e.details === "string" ? e.details : JSON.stringify(e.details, null, 2)}` : "")
          : String(e);
      setError(detail);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToggle = async (id: string, saved: boolean) => {
    setList((prev) => prev.map((r) => (r.id === id ? { ...r, saved } : r)));
    try {
      await api.post<{ recommendation: CareerRow }>(
        `/api/careers/${id}/${saved ? "save" : "unsave"}`,
      );
    } catch (e) {
      setList((prev) => prev.map((r) => (r.id === id ? { ...r, saved: !saved } : r)));
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    }
  };

  return (
    <section className="section">
      <header className="row-baseline" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Career matches</h2>
        <div className="row" style={{ gap: 12 }}>
          <label className="row muted-sm" style={{ cursor: "pointer", gap: 6 }}>
            <input
              type="checkbox"
              checked={savedOnly}
              onChange={(e) => setSavedOnly(e.target.checked)}
            />
            ★ Saved only
          </label>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={{ minWidth: 140 }}
          >
            {generating ? "Matching…" : list.length > 0 ? "Regenerate" : "Match me"}
          </button>
        </div>
      </header>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {meta && (
        <div className="card-muted" style={{ marginBottom: 16 }}>
          <p className="body-sm" style={{ margin: 0 }}>{meta.summary}</p>
          {meta.nextSteps.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: "12px 0 6px" }}>
                Next steps
              </div>
              <ul className="body-sm" style={{ margin: 0, paddingLeft: 18 }}>
                {meta.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {meta.safetyNotes && (
            <p className="muted-italic" style={{ margin: "12px 0 0" }}>
              {meta.safetyNotes}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : (() => {
          const visible = savedOnly ? list.filter((r) => r.saved) : list;
          if (visible.length === 0) {
            return (
              <div className="empty-state">
                {savedOnly
                  ? "Nothing saved yet. Star a match to keep it here."
                  : (
                    <>
                      No matches yet. Click <strong>Match me</strong> to generate from your profile.
                    </>
                  )}
              </div>
            );
          }
          return (
            <div className="card-grid">
              {visible.map((row) => (
                <CareerCard key={row.id} row={row} onSaveToggle={handleSaveToggle} />
              ))}
            </div>
          );
        })()}
    </section>
  );
}
