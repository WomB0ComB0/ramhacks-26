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

// Browsers with third-party cookie restrictions (Chrome incremental rollout,
// Safari ITP, Brave, Firefox strict) drop the cross-site
// `__Secure-better-auth.session_token` cookie even with `SameSite=None;
// Secure`. Without the cookie, /get-session returns null after a successful
// sign-in and the UI stays stuck on the auth screen. Mirror Better Auth's
// bearer flow into localStorage so session persistence survives cookie loss.
const BEARER_TOKEN_KEY = "ramhacks-26.bearer-token";

function readBearer(): string {
  try {
    return globalThis.localStorage?.getItem(BEARER_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeBearer(token: string): void {
  try {
    globalThis.localStorage?.setItem(BEARER_TOKEN_KEY, token);
  } catch {}
}

function clearBearer(): void {
  try {
    globalThis.localStorage?.removeItem(BEARER_TOKEN_KEY);
  } catch {}
}

export const client = createClient({
  auth: {
    adapter: BetterAuthReactAdapter({
      fetchOptions: {
        // Attach Authorization: Bearer <session-token> to every Better Auth
        // request so /get-session works even when the cross-origin cookie is
        // dropped. The server-side bearer() plugin in
        // backend/src/lib/auth-server.ts accepts this header and resolves the
        // matching session row.
        auth: {
          type: "Bearer",
          token: readBearer,
        },
        // Capture the bearer token Better Auth issues on sign-in / sign-up.
        // The server's CORS config exposes `Set-Auth-Token`
        // (backend/src/server.ts:47) so the header reaches us in the browser.
        onSuccess: (ctx) => {
          const issued = ctx.response.headers.get("set-auth-token");
          if (issued) writeBearer(issued);
        },
      },
    }),
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
export const signOut = async () => {
  const result = await client.auth.signOut();
  // Drop the bearer AFTER the request completes — clearing it first would
  // make the sign-out call itself unauthenticated.
  clearBearer();
  return result;
};

/**
 * Returns the current bearer session token for forwarding to our Express API
 * as `Authorization: Bearer <token>`. Returns null if the user is not signed
 * in. Reads from localStorage (not session.data.session.token) because the
 * Neon adapter overwrites session.token with the JWT plugin's value, which
 * the backend's bearer plugin would not recognize.
 */
export async function getAuthToken(): Promise<string | null> {
  const stored = readBearer();
  return stored ? stored : null;
}
