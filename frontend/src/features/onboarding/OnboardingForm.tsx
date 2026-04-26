import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/api/client";
import ErrorBanner from "@/components/ui/ErrorBanner";

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

// inputStyle/labelStyle removed — global form CSS in index.css handles
// inputs/textareas/selects, and `.field` + `.field-label` give the
// label/control rhythm. fieldGap kept as a single "between-fields"
// margin since OnboardingForm renders fields as direct children of
// the form (vs NetworkingPanel which uses .stack-3 to gap them).
const fieldGap = { marginBottom: 16 } as const;

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

      <div style={fieldGap}>
        <label className="field-label" style={{ display: "block", marginBottom: 6 }} htmlFor="major">
          Major or focus area *
        </label>
        <input
          id="major"
          
          placeholder="e.g. Computer Science"
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          required
        />
      </div>

      <div className="field-row" style={{ marginBottom: 16 }}>
        <div>
          <label className="field-label" style={{ display: "block", marginBottom: 6 }} htmlFor="education">
            Education level
          </label>
          <select
            id="education"
            
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
          <label className="field-label" style={{ display: "block", marginBottom: 6 }} htmlFor="experience">
            Experience level
          </label>
          <select
            id="experience"
            
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

      <div style={fieldGap}>
        <label className="field-label" style={{ display: "block", marginBottom: 6 }} htmlFor="interests">
          Interests * <span style={{ opacity: 0.6 }}>(comma-separated)</span>
        </label>
        <input
          id="interests"
          
          placeholder="e.g. ml, education, social impact"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
        />
      </div>

      <div style={fieldGap}>
        <label className="field-label" style={{ display: "block", marginBottom: 6 }} htmlFor="skills">
          Current skills * <span style={{ opacity: 0.6 }}>(comma-separated)</span>
        </label>
        <input
          id="skills"
          
          placeholder="e.g. python, react, sql"
          value={currentSkills}
          onChange={(e) => setCurrentSkills(e.target.value)}
        />
      </div>

      <div style={fieldGap}>
        <label className="field-label" style={{ display: "block", marginBottom: 6 }} htmlFor="industries">
          Target industries <span style={{ opacity: 0.6 }}>(comma-separated)</span>
        </label>
        <input
          id="industries"
          
          placeholder="e.g. edtech, nonprofit, healthcare"
          value={targetIndustries}
          onChange={(e) => setTargetIndustries(e.target.value)}
        />
      </div>

      <div style={fieldGap}>
        <label className="field-label" style={{ display: "block", marginBottom: 6 }} htmlFor="goals">
          Career goals *
        </label>
        <textarea
          id="goals"
          style={{ minHeight: 80, resize: "vertical" }}
          placeholder="What you want to do, in one or two sentences."
          value={careerGoals}
          onChange={(e) => setCareerGoals(e.target.value)}
          required
        />
      </div>

      <div className="field-row" style={{ marginBottom: 16 }}>
        <div>
          <label className="field-label" style={{ display: "block", marginBottom: 6 }} htmlFor="budget">
            Budget constraints
          </label>
          <input
            id="budget"
            
            placeholder="e.g. low — free programs only"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" style={{ display: "block", marginBottom: 6 }}>Remote-only OK?</label>
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

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

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
