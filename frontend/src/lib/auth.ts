import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

// Plan C: we self-host Better Auth on the Express backend (mounted at
// /api/auth/*). The frontend talks to that endpoint instead of Neon's hosted
// auth proxy — eliminates the cross-origin INVALID_ORIGIN dependency on
// Neon's Console UI.

const apiBase = import.meta.env.VITE_API_BASE_URL;
if (!apiBase) {
  throw new Error(
    "VITE_API_BASE_URL is not set. Set it to your backend URL (e.g. https://ramhacks-26-production.up.railway.app).",
  );
}
const url = `${apiBase.replace(/\/$/, "")}/api/auth`;

export const client = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url,
  },
  // dataApi is required by createClient's type but unused here — we hit our
  // own Express backend (backend/src/server.ts) instead of Neon's Data API.
  // Set to the same auth URL as a harmless placeholder.
  dataApi: { url },
});

// Convenience re-exports so app code doesn't depend on the client shape directly.
export const authClient = client.auth;
export const useSession = client.auth.useSession;
export const signIn = client.auth.signIn;
export const signUp = client.auth.signUp;
export const signOut = () => client.auth.signOut();

/**
 * Returns the current session JWT for forwarding to our Express API as
 * `Authorization: Bearer <token>`. Returns null if the user is not signed in.
 *
 * Use from the fetch wrapper in `frontend/src/api/client.ts` (to be created).
 */
export async function getAuthToken(): Promise<string | null> {
  const session = await client.auth.getSession?.();
  return session?.data?.session?.token ?? null;
}
