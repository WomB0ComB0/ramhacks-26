import { useSession } from "./lib/auth";
import SignedOut from "./app/SignedOut";
import SignedIn from "./app/SignedIn";

export default function App() {
  const session = useSession();

  if (session.isPending) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100svh" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!session.data?.user) {
    return <SignedOut />;
  }

  return <SignedIn user={session.data.user} />;
}
