import type { ProfileRow } from "./types";

export default function ProfileSummary({ profile }: { profile: ProfileRow }) {
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
