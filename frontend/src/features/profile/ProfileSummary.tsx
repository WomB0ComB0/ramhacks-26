import type { ProfileRow } from "./types";

export default function ProfileSummary({ profile }: { profile: ProfileRow }) {
  const tags = (xs: string[]) =>
    xs.length === 0 ? (
      <span className="muted-sm">—</span>
    ) : (
      <div className="cluster">
        {xs.map((x) => (
          <span key={x} className="kbd">
            {x}
          </span>
        ))}
      </div>
    );

  return (
    <section className="card section-tight">
      <div className="row-baseline">
        <h2 style={{ margin: 0 }}>Your profile</h2>
        <span className="kbd">{profile.major ?? "—"}</span>
      </div>
      <div className="meta-grid" style={{ marginTop: 14 }}>
        <div className="muted">Education</div>
        <div>{profile.educationLevel ?? "—"}</div>
        <div className="muted">Experience</div>
        <div>{profile.experienceLevel ?? "—"}</div>
        <div className="muted">Interests</div>
        <div>{tags(profile.interests)}</div>
        <div className="muted">Skills</div>
        <div>{tags(profile.currentSkills)}</div>
        <div className="muted">Industries</div>
        <div>{tags(profile.targetIndustries)}</div>
        <div className="muted">Goals</div>
        <div>{profile.careerGoals ?? "—"}</div>
      </div>
    </section>
  );
}
