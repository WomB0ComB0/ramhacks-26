import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/api/client";
import ErrorBanner from "@/components/ui/ErrorBanner";

type Channel = "linkedin" | "email" | "twitter" | "in_person";
type Tone = "warm" | "professional" | "concise" | "enthusiastic" | "humble";
type RecipientType =
  | "recruiter"
  | "engineer"
  | "founder"
  | "professor"
  | "alum"
  | "mentor"
  | "peer";

interface GenerateResponse {
  message: string;
  alternatives: string[];
  followUps: string[];
  questions: string[];
  subjectLine?: string;
  toneNotes?: string;
}

const CHANNEL_OPTIONS: ReadonlyArray<{ value: Channel; label: string }> = [
  { value: "linkedin", label: "LinkedIn DM" },
  { value: "email", label: "Email" },
  { value: "twitter", label: "Twitter / X" },
  { value: "in_person", label: "In person" },
];

const TONE_OPTIONS: ReadonlyArray<{ value: Tone; label: string }> = [
  { value: "warm", label: "Warm" },
  { value: "professional", label: "Professional" },
  { value: "concise", label: "Concise" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "humble", label: "Humble" },
];

const RECIPIENT_OPTIONS: ReadonlyArray<{ value: RecipientType; label: string }> = [
  { value: "recruiter", label: "Recruiter" },
  { value: "engineer", label: "Engineer" },
  { value: "founder", label: "Founder" },
  { value: "professor", label: "Professor" },
  { value: "alum", label: "Alum" },
  { value: "mentor", label: "Mentor" },
  { value: "peer", label: "Peer" },
];

function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard not available - fall through silently
    }
  };
  return (
    <div
      style={{
        position: "relative",
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      <p style={{ margin: 0, color: "var(--text)", whiteSpace: "pre-wrap", fontSize: 14 }}>
        {text}
      </p>
      <button
        onClick={onCopy}
        className="btn"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          padding: "4px 8px",
          fontSize: 11,
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function NetworkingPanel() {
  const [recipientType, setRecipientType] = useState<RecipientType>("engineer");
  const [recipientName, setRecipientName] = useState("");
  const [recipientRole, setRecipientRole] = useState("");
  const [recipientOrg, setRecipientOrg] = useState("");
  const [sharedConnection, setSharedConnection] = useState("");
  const [channel, setChannel] = useState<Channel>("linkedin");
  const [tone, setTone] = useState<Tone>("warm");
  const [ask, setAsk] = useState("");
  const [context, setContext] = useState("");

  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (ask.trim().length < 5) {
      setError("Tell us what you want to ask for (at least a few words).");
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<GenerateResponse>("/api/networking/generate", {
        recipient: {
          type: recipientType,
          name: recipientName || undefined,
          role: recipientRole || undefined,
          organization: recipientOrg || undefined,
          sharedConnection: sharedConnection || undefined,
        },
        channel,
        tone,
        ask,
        context: context || undefined,
      });
      setResult(res);
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

  return (
    <section style={{ marginTop: 24 }}>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Networking message</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 14 }}>
          Draft an outreach DM, email, or intro - tailored to who you're contacting and what you
          want.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Recipient type</span>
            <select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value as RecipientType)}
              style={selectStyle}
            >
              {RECIPIENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              style={selectStyle}
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Recipient name (optional)</span>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Jane Doe"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Their role (optional)</span>
            <input
              type="text"
              value={recipientRole}
              onChange={(e) => setRecipientRole(e.target.value)}
              placeholder="Staff Engineer at Stripe"
              style={inputStyle}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Their org (optional)</span>
            <input
              type="text"
              value={recipientOrg}
              onChange={(e) => setRecipientOrg(e.target.value)}
              placeholder="Stripe"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Shared connection (optional)</span>
            <input
              type="text"
              value={sharedConnection}
              onChange={(e) => setSharedConnection(e.target.value)}
              placeholder="Both went to RamHacks 2024"
              style={inputStyle}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Tone</span>
          <div className="seg" role="tablist" style={{ width: "fit-content" }}>
            {TONE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="tab"
                aria-selected={tone === o.value}
                onClick={() => setTone(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Your ask *</span>
          <textarea
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            rows={3}
            placeholder="20 minutes on their calendar to learn how they got into ML infra"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Extra context (optional)</span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            placeholder="I read their post on LLM evaluation and have a question about their setup"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-primary" disabled={generating}>
            {generating ? "Drafting…" : "Draft message"}
          </button>
        </div>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {result && (
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {result.subjectLine && (
            <CopyBlock text={result.subjectLine} label="Subject line" />
          )}
          <CopyBlock text={result.message} label="Primary message" />
          {result.alternatives.length > 0 &&
            result.alternatives.map((alt, i) => (
              <CopyBlock key={`alt-${i}`} text={alt} label={`Alternative ${i + 1}`} />
            ))}
          {result.followUps.length > 0 && (
            <details
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Follow-ups (if no reply in 5 days)
              </summary>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {result.followUps.map((f, i) => (
                  <CopyBlock key={`f-${i}`} text={f} />
                ))}
              </div>
            </details>
          )}
          {result.questions.length > 0 && (
            <div className="card-muted">
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                If you get a meeting, ask
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text)", fontSize: 14 }}>
                {result.questions.map((q, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.toneNotes && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              {result.toneNotes}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 14,
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
