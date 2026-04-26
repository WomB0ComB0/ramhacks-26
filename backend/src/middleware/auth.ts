import type { Request, Response, NextFunction } from "express";
import type { JWTPayload } from "jose";
import { auth } from "../lib/auth-server";
import { fromNodeHeaders } from "better-auth/node";

// We host Better Auth ourselves (Plan C). Session validation is a local call
// — no JWKS roundtrip, no DB query soup. Better Auth handles bearer tokens
// (via the bearer plugin) and cookie sessions transparently.

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

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      res.status(401).json({
        error: { code: "unauthorized", message: "Invalid or missing session." },
      });
      return;
    }

    req.auth = {
      userId: session.user.id,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      claims: { sub: session.user.id } as JWTPayload,
    };
    next();
  } catch (err) {
    req.log?.error({ err }, "auth: getSession failed");
    console.error("[auth] getSession threw:", err);
    res.status(500).json({
      error: {
        code: "internal",
        message: "Auth verification failed.",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : String((err as Error)?.message ?? err).slice(0, 500),
      },
    });
  }
};
