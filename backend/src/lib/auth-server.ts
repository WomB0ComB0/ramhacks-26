import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, jwt } from "better-auth/plugins";
import { db } from "@/db/client";
import * as authSchema from "@/db/auth-schema";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET is missing or too short (need 32+ chars). Generate with: openssl rand -hex 32",
  );
}

const trustedOrigins = [
  process.env.CORS_ORIGIN,
  "http://localhost:5173",
  "http://localhost:4000",
].filter(Boolean) as string[];

const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.VITE_API_BASE_URL ??
  "http://localhost:4000";

export const auth = betterAuth({
  baseURL,
  basePath: "/api/auth",
  secret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins,
  // bearer: accept Authorization: Bearer <token> from cross-origin clients
  // jwt: stateless JWT issuance + JWKS endpoint at /api/auth/jwks
  plugins: [bearer(), jwt()],
  // Brute-force protection on credential endpoints. Better Auth's built-in
  // limiter runs before any handler, so a credential-stuffing attempt costs
  // the attacker latency without reaching the DB. Default storage is in-memory
  // (sufficient for single-container Railway deploy); persist to DB if you
  // ever scale horizontally.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 3 },
    },
  },
  advanced: {
    // The neon_auth tables have `id uuid DEFAULT gen_random_uuid()` — let
    // Postgres fill the id column instead of Better Auth generating nanoid
    // strings (which fail UUID type checking).
    database: {
      generateId: false,
    },
    crossSubDomainCookies: { enabled: false },
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
});

export type AuthInstance = typeof auth;
