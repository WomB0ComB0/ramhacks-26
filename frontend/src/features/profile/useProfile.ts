import { useEffect, useState } from "react";
import { api, ApiError } from "@/api/client";
import type { ProfileRow } from "./types";

export type ProfileState =
  | { kind: "loading" }
  | { kind: "absent" }
  | { kind: "ready"; profile: ProfileRow }
  | { kind: "error"; message: string };

export function useProfile() {
  const [state, setState] = useState<ProfileState>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const data = await api.get<{ profile: ProfileRow }>("/api/profile");
        if (!cancelled) setState({ kind: "ready", profile: data.profile });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setState({ kind: "absent" });
        } else if (e instanceof ApiError) {
          setState({ kind: "error", message: `${e.status} ${e.code}: ${e.message}` });
        } else {
          setState({ kind: "error", message: String(e) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { state, refetch: () => setVersion((v) => v + 1) };
}
