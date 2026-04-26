import { AccountView } from "@neondatabase/neon-js/auth/react/ui";
import { signOut } from "../lib/auth";
import { useProfile } from "../features/profile/useProfile";
import ProfileSummary from "../features/profile/ProfileSummary";
import OnboardingForm from "../components/OnboardingForm";
import CareerMatches from "../components/CareerMatches";
import OpportunityList from "../components/OpportunityList";
import ActionPlanPanel from "../components/ActionPlanPanel";
import NetworkingPanel from "../components/NetworkingPanel";
import ErrorBanner from "../components/ErrorBanner";
import Brand from "./Brand";
import SmokeTest from "./SmokeTest";
import DangerZone from "./DangerZone";

export default function SignedIn({
  user,
}: {
  user: { id: string; email: string; name?: string };
}) {
  const { state, refetch } = useProfile();

  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Brand />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{user.email}</span>
          <button className="btn btn-ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ width: "100%", maxWidth: 880, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ marginBottom: 8 }}>Welcome{user.name ? `, ${user.name}` : ""}.</h1>
        <p style={{ color: "var(--text-muted)" }}>
          <span className="kbd">userId</span>{" "}
          <span style={{ marginLeft: 6, fontFamily: "ui-monospace, Menlo", fontSize: 12 }}>
            {user.id}
          </span>
        </p>

        {state.kind === "loading" && (
          <p style={{ color: "var(--text-muted)", marginTop: 24 }}>Loading profile…</p>
        )}

        {state.kind === "error" && <ErrorBanner message={state.message} />}

        {state.kind === "absent" && <OnboardingForm onSaved={refetch} />}

        {state.kind === "ready" && (
          <>
            <ProfileSummary profile={state.profile} />
            <CareerMatches />
            <OpportunityList />
            <ActionPlanPanel />
            <NetworkingPanel />
          </>
        )}

        {new URLSearchParams(window.location.search).get("debug") === "1" && <SmokeTest />}

        <section style={{ marginTop: 32 }}>
          <h2>Account</h2>
          <div className="card-muted" style={{ marginTop: 8 }}>
            <AccountView />
          </div>
        </section>

        <DangerZone />
      </main>
    </div>
  );
}
