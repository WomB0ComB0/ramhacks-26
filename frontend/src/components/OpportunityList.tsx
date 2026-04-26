import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import ErrorBanner from "./ErrorBanner";
import { SkeletonGrid } from "./Skeleton";

type OpportunityKind =
  | "fellowship"
  | "internship"
  | "bootcamp"
  | "scholarship"
  | "program"
  | "community"
  | "competition";

interface Opportunity {
  slug: string;
  name: string;
  organization: string;
  kind: OpportunityKind;
  oneLiner: string;
  description: string;
  eligibility: string[];
  applicationSteps: string[];
  applyUrl: string;
  applyByMonth?: number;
  remoteOk: boolean;
  location?: string;
  costUsd: number;
  stipendUsd?: number;
  tags: string[];
  skills: string[];
  audience: string[];
  experience?: string[];
  score: number;
  matchedTags: string[];
  matchedSkills: string[];
}

interface MatchResponse {
  profileSnapshot: {
    tags: string[];
    skills: string[];
    audience: string | null;
  };
  opportunities: Opportunity[];
}

const KIND_OPTIONS: ReadonlyArray<{ value: OpportunityKind | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "fellowship", label: "Fellowships" },
  { value: "internship", label: "Internships" },
  { value: "scholarship", label: "Scholarships" },
  { value: "program", label: "Programs" },
  { value: "bootcamp", label: "Bootcamps" },
  { value: "community", label: "Communities" },
  { value: "competition", label: "Competitions" },
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatMoney(n: number) {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

function KindBadge({ kind }: { kind: OpportunityKind }) {
  const colorMap: Record<OpportunityKind, string> = {
    fellowship: "#a78bfa",
    internship: "#34d399",
    scholarship: "#fbbf24",
    program: "#60a5fa",
    bootcamp: "#fb7185",
    community: "#f472b6",
    competition: "#f97316",
  };
  return (
    <span
      className="kbd"
      style={{
        color: colorMap[kind],
        borderColor: colorMap[kind],
        textTransform: "capitalize",
      }}
    >
      {kind}
    </span>
  );
}

function OpportunityCard({
  opp,
  saved,
  onSaveToggle,
}: {
  opp: Opportunity;
  saved: boolean;
  onSaveToggle: (slug: string, next: boolean, savedRowId?: string) => void;
}) {
  return (
    <article className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              color: "var(--text-strong)",
              letterSpacing: "-0.01em",
            }}
          >
            {opp.name}
          </h3>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
            {opp.organization}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <KindBadge kind={opp.kind} />
          <button
            className="btn"
            style={{
              padding: "4px 8px",
              fontSize: 12,
              background: saved ? "var(--accent-soft)" : undefined,
              borderColor: saved ? "var(--accent)" : undefined,
            }}
            onClick={() => onSaveToggle(opp.slug, !saved)}
          >
            {saved ? "★ Saved" : "☆ Save"}
          </button>
        </div>
      </header>

      <p style={{ color: "var(--text)", fontSize: 14, margin: 0 }}>{opp.oneLiner}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 12 }}>
        {opp.remoteOk && (
          <span className="kbd" style={{ color: "#34d399" }}>
            Remote OK
          </span>
        )}
        {opp.location && <span className="kbd">{opp.location}</span>}
        {opp.costUsd === 0 ? (
          <span className="kbd" style={{ color: "#34d399" }}>
            Free
          </span>
        ) : (
          <span className="kbd">Cost {formatMoney(opp.costUsd)}</span>
        )}
        {opp.stipendUsd ? (
          <span className="kbd" style={{ color: "#34d399" }}>
            Stipend {formatMoney(opp.stipendUsd)}
          </span>
        ) : null}
        {opp.applyByMonth ? (
          <span className="kbd">Apply by {MONTHS[opp.applyByMonth - 1]}</span>
        ) : (
          <span className="kbd">Rolling</span>
        )}
      </div>

      {(opp.matchedTags.length > 0 || opp.matchedSkills.length > 0) && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Why this matches
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {opp.matchedTags.map((t) => (
              <span key={`t-${t}`} className="kbd" style={{ color: "#a78bfa" }}>
                {t}
              </span>
            ))}
            {opp.matchedSkills.map((s) => (
              <span key={`s-${s}`} className="kbd" style={{ color: "#60a5fa" }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <details style={{ fontSize: 13, color: "var(--text-muted)" }}>
        <summary style={{ cursor: "pointer" }}>About / eligibility</summary>
        <p style={{ marginTop: 8, color: "var(--text)" }}>{opp.description}</p>
        {opp.eligibility.length > 0 && (
          <>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 500,
                margin: "10px 0 4px",
              }}
            >
              Eligibility
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text)", fontSize: 13 }}>
              {opp.eligibility.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </>
        )}
        {opp.applicationSteps.length > 0 && (
          <>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 500,
                margin: "10px 0 4px",
              }}
            >
              Application steps
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, color: "var(--text)", fontSize: 13 }}>
              {opp.applicationSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </>
        )}
      </details>

      <a
        href={opp.applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        style={{ textAlign: "center", marginTop: "auto" }}
      >
        Apply ↗
      </a>
    </article>
  );
}

interface SavedRow {
  id: string;
  sourceId: string | null;
}

export default function OpportunityList() {
  const [list, setList] = useState<Opportunity[]>([]);
  const [savedBySlug, setSavedBySlug] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<OpportunityKind | "all">("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const params = new URLSearchParams();
      if (kind !== "all") params.set("kind", kind);
      if (remoteOnly) params.set("remoteOnly", "true");
      if (freeOnly) params.set("freeOnly", "true");
      params.set("limit", "12");
      try {
        const [match, saved] = await Promise.all([
          api.get<MatchResponse>(`/api/opportunities/match?${params}`),
          api.get<{ opportunities: SavedRow[] }>("/api/opportunities/saved"),
        ]);
        if (cancelled) return;
        setList(match.opportunities);
        const map: Record<string, string> = {};
        for (const r of saved.opportunities) {
          if (r.sourceId) map[r.sourceId] = r.id;
        }
        setSavedBySlug(map);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, remoteOnly, freeOnly]);

  const handleSaveToggle = async (slug: string, next: boolean) => {
    const prevId = savedBySlug[slug];
    setSavedBySlug((m) => {
      const copy = { ...m };
      if (next) copy[slug] = prevId ?? "pending";
      else delete copy[slug];
      return copy;
    });
    try {
      if (next) {
        const res = await api.post<{ opportunity: { id: string } }>(
          "/api/opportunities/save",
          { slug },
        );
        setSavedBySlug((m) => ({ ...m, [slug]: res.opportunity.id }));
      } else if (prevId && prevId !== "pending") {
        await api.post(`/api/opportunities/${prevId}/unsave`);
      }
    } catch (e) {
      setSavedBySlug((m) => {
        const copy = { ...m };
        if (next) delete copy[slug];
        else if (prevId) copy[slug] = prevId;
        return copy;
      });
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    }
  };

  const visible = savedOnly ? list.filter((o) => savedBySlug[o.slug]) : list;

  return (
    <section style={{ marginTop: 24 }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Opportunities</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 14 }}>
          Curated fellowships, internships, and programs ranked against your profile.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <div className="seg" role="tablist">
          {KIND_OPTIONS.map((k) => (
            <button
              key={k.value}
              role="tab"
              aria-selected={kind === k.value}
              onClick={() => setKind(k.value)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={remoteOnly}
            onChange={(e) => setRemoteOnly(e.target.checked)}
          />
          Remote only
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => setFreeOnly(e.target.checked)}
          />
          Free only
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={savedOnly}
            onChange={(e) => setSavedOnly(e.target.checked)}
          />
          ★ Saved only
        </label>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : visible.length === 0 ? (
        <div className="card-muted" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {savedOnly
              ? "Nothing saved yet. Hit ☆ Save on any opportunity to keep it here."
              : "No opportunities match these filters. Try widening them."}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {visible.map((opp) => (
            <OpportunityCard
              key={opp.slug}
              opp={opp}
              saved={Boolean(savedBySlug[opp.slug])}
              onSaveToggle={handleSaveToggle}
            />
          ))}
        </div>
      )}
    </section>
  );
}
