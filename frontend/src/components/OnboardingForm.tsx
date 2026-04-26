import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";

type EducationLevel =
  | "high_school"
  | "undergraduate"
  | "graduate"
  | "phd"
  | "bootcamp"
  | "self_taught"
  | "professional"
  | "other";

type ExperienceLevel = "none" | "entry" | "mid" | "senior";

interface ProfileInput {
  major: string;
  educationLevel: EducationLevel;
  experienceLevel: ExperienceLevel;
  interests: string[];
  currentSkills: string[];
  targetIndustries: string[];
  careerGoals: string;
  preferredWorkStyle: string[];
  location?: { remoteOk?: boolean };
  constraints?: { schedule?: string; budget?: string; transport?: string };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-elev)",
  color: "var(--text-strong)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 14,
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "var(--text-muted)",
  marginBottom: 6,
  fontWeight: 500,
};

const fieldStyle: React.CSSProperties = { marginBottom: 16 };

function splitTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function OnboardingForm({ onSaved }: { onSaved: () => void }) {
  const [major, setMajor] = useState("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("undergraduate");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("entry");
  const [interests, setInterests] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [targetIndustries, setTargetIndustries] = useState("");
  const [careerGoals, setCareerGoals] = useState("");
  const [remoteOk, setRemoteOk] = useState(true);
  const [budget, setBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const interestsArr = splitTags(interests);
    const skillsArr = splitTags(currentSkills);
    const industriesArr = splitTags(targetIndustries);

    if (
      !major.trim() ||
      !careerGoals.trim() ||
      interestsArr.length === 0 ||
      skillsArr.length === 0
    ) {
      setError("Major, goals, interests, and skills are required.");
      return;
    }

    const body: ProfileInput = {
      major: major.trim(),
      educationLevel,
      experienceLevel,
      interests: interestsArr,
      currentSkills: skillsArr,
      targetIndustries: industriesArr,
      careerGoals: careerGoals.trim(),
      preferredWorkStyle: [],
      location: { remoteOk },
      constraints: budget.trim() ? { budget: budget.trim() } : undefined,
    };

    setSubmitting(true);
    try {
      await api.post("/api/profile", body);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(`${e.status} ${e.code}: ${e.message}`);
      } else {
        setError(String(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ padding: 24, marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Tell us about you</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
        Used to personalize career matches and the action plan.
      </p>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="major">
          Major or focus area *
        </label>
        <input
          id="major"
          style={inputStyle}
          placeholder="e.g. Computer Science"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          required
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="education">
            Education level
          </label>
          <select
            id="education"
            style={inputStyle}
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
          >
            <option value="high_school">High school</option>
            <option value="undergraduate">Undergraduate</option>
            <option value="graduate">Graduate</option>
            <option value="phd">PhD</option>
            <option value="bootcamp">Bootcamp</option>
            <option value="self_taught">Self-taught</option>
            <option value="professional">Professional</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="experience">
            Experience level
          </label>
          <select
            id="experience"
            style={inputStyle}
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
          >
            <option value="none">None</option>
            <option value="entry">Entry</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="interests">
          Interests * <span style={{ opacity: 0.6 }}>(comma-separated)</span>
        </label>
        <input
          id="interests"
          style={inputStyle}
          placeholder="e.g. ml, education, social impact"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="skills">
          Current skills * <span style={{ opacity: 0.6 }}>(comma-separated)</span>
        </label>
        <input
          id="skills"
          style={inputStyle}
          placeholder="e.g. python, react, sql"
          value={currentSkills}
          onChange={(e) => setCurrentSkills(e.target.value)}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="industries">
          Target industries <span style={{ opacity: 0.6 }}>(comma-separated)</span>
        </label>
        <input
          id="industries"
          style={inputStyle}
          placeholder="e.g. edtech, nonprofit, healthcare"
          value={targetIndustries}
          onChange={(e) => setTargetIndustries(e.target.value)}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="goals">
          Career goals *
        </label>
        <textarea
          id="goals"
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          placeholder="What you want to do, in one or two sentences."
          value={careerGoals}
          onChange={(e) => setCareerGoals(e.target.value)}
          required
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="budget">
            Budget constraints
          </label>
          <input
            id="budget"
            style={inputStyle}
            placeholder="e.g. low — free programs only"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Remote-only OK?</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
            <input
              type="checkbox"
              checked={remoteOk}
              onChange={(e) => setRemoteOk(e.target.checked)}
            />
            <span style={{ color: "var(--text)" }}>Yes</span>
          </label>
        </div>
      </div>

      {error && <pre className="pre-err">{error}</pre>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting}
        style={{ width: "100%", marginTop: 8 }}
      >
        {submitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
