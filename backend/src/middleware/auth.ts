import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// Neon Auth (Better Auth + JWT plugin) issues EdDSA-signed JWTs. We verify
// locally against the published JWKS (Ed25519 public key from neon_auth.jwks).
// This is the canonical path:
//   1. JWKS verify (`${AUTH_BASE}/.well-known/jwks.json`) — primary
//   2. DB lookup against neon_auth.session — fallback (opaque-token deployments)
//   3. HTTP /get-session — last resort

const AUTH_BASE = (process.env.VITE_NEON_AUTH_URL ?? process.env.NEON_AUTH_BASE_URL ?? "")
  .replace(/\/?$/, "/");

if (!AUTH_BASE) {
  throw new Error(
    "VITE_NEON_AUTH_URL is not set. Copy it from the Neon Console → Auth → Quickstart panel.",
  );
}

export interface AuthContext {
  userId: string;
  email?: string;
  name?: string;
  claims: JWTPayload;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization ?? "";
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && value) return value;
  return null;
}

type SessionRow = {
  user_id: string;
  expires_at: string;
  email: string | null;
  name: string | null;
} & Record<string, unknown>;

interface RemoteUser {
  id: string;
  email?: string;
  name?: string;
}

const JWKS_URL = new URL(".well-known/jwks.json", AUTH_BASE);
const jwks = createRemoteJWKSet(JWKS_URL, { cooldownDuration: 60_000 });

async function tryJwksVerify(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwks);
    return payload;
  } catch (e) {
    console.warn(
      `[auth] jwks ${JWKS_URL.toString()} did not verify:`,
      String((e as Error).message ?? e).slice(0, 160),
    );
    return null;
  }
}

async function tryHttpSession(token: string): Promise<RemoteUser | null> {
  // Better Auth standard endpoints under the same hosted base — try the most
  // common paths in order. Stops on the first 200 with a user.
  const candidates = ["get-session", "api/auth/get-session"];
  for (const path of candidates) {
    try {
      const url = new URL(path, AUTH_BASE);
      const r = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!r.ok) {
        console.warn(`[auth] ${url.toString()} → ${r.status}`);
        continue;
      }
      const data = (await r.json()) as { user?: RemoteUser } | RemoteUser | null;
      const user =
        data && typeof data === "object" && "user" in data && data.user
          ? data.user
          : (data as RemoteUser | null);
      if (user?.id) {
        console.log(`[auth] verified via ${url.toString()}`);
        return { id: user.id, email: user.email, name: user.name };
      }
      console.warn(`[auth] ${url.toString()} → 200 but no user`);
    } catch (e) {
      console.warn(
        `[auth] ${path} threw:`,
        String((e as Error).message ?? e).slice(0, 160),
      );
    }
  }
  return null;
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      error: { code: "unauthorized", message: "Missing session token." },
    });
    return;
  }

  // 1. JWKS verify (canonical for Neon Auth + JWT plugin).
  const claims = await tryJwksVerify(token);
  if (claims?.sub) {
    req.auth = {
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      name: typeof claims.name === "string" ? claims.name : undefined,
      claims,
    };
    next();
    return;
  }

  try {
    const result = await db.execute<SessionRow>(sql`
      SELECT
        s."userId"   AS user_id,
        s."expiresAt" AS expires_at,
        u.email      AS email,
        u.name       AS name
      FROM neon_auth.session s
      LEFT JOIN neon_auth."user" u ON u.id = s."userId"
      WHERE s.token = ${token} AND s."expiresAt" > now()
      LIMIT 1
    `);
    const rows =
      (result as unknown as { rows?: SessionRow[] }).rows ??
      (result as unknown as SessionRow[]);
    const row = Array.isArray(rows) ? rows[0] : undefined;

    if (!row?.user_id) {
      // Fast-path miss — try the auth server directly.
      console.warn(
        `[auth] db miss — len=${token.length} prefix=${token.slice(0, 12)}… falling back to /get-session`,
      );
      const remote = await tryHttpSession(token);
      if (remote) {
        req.auth = {
          userId: remote.id,
          email: remote.email,
          name: remote.name,
          claims: { sub: remote.id } as JWTPayload,
        };
        next();
        return;
      }
      res.status(401).json({
        error: { code: "unauthorized", message: "Invalid or expired session." },
      });
      return;
    }

    req.auth = {
      userId: row.user_id,
      email: row.email ?? undefined,
      name: row.name ?? undefined,
      claims: { sub: row.user_id } as JWTPayload,
    };
    next();
  } catch (err) {
    req.log?.error({ err }, "auth: session lookup failed");
    res.status(500).json({
      error: { code: "internal", message: "Auth verification failed." },
    });
  }
};
