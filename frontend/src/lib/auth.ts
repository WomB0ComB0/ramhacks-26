import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

// Neon Auth (built on Better Auth) — unified SDK.
// VITE_NEON_AUTH_URL comes from your Neon Console → Auth → Quickstart panel
// and is the same issuer URL the Express backend (backend/src/middleware/auth.ts)
// uses for JWKS verification.

const url = import.meta.env.VITE_NEON_AUTH_URL;
if (!url) {
  throw new Error(
    "VITE_NEON_AUTH_URL is not set. Copy it from the Neon Console → Auth → Quickstart panel into .env.",
  );
}

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
