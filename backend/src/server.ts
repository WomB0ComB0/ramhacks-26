import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import profileRouter from "./routes/profile";
import careersRouter from "./routes/careers";
import actionPlansRouter from "./routes/actionPlans";
import opportunitiesRouter from "./routes/opportunities";
import meRouter from "./routes/me";
import networkingRouter from "./routes/networking";
import { auth } from "./lib/auth-server";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.body.password",
    "req.body.email",
    "req.body.token",
    "req.body.secret",
    "res.headers['set-cookie']",
  ],
});

export function buildApp() {
  const app = express();

  // Security headers (Helmet defaults: HSTS, X-Content-Type-Options, frame-ancestors).
  app.use(helmet());

  // CORS — single trusted origin in dev (the Vite frontend).
  const origin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  app.use(
    cors({
      origin,
      credentials: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Neon-Client-Info", // sent by @neondatabase/auth SDK on every request
        "X-Requested-With",
      ],
      exposedHeaders: ["Set-Auth-Token"], // Better Auth uses this for bearer flows
    }),
  );

  // Better Auth handler — MUST mount before express.json because it parses its own body.
  app.all("/api/auth/*", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  // Per-IP global rate limit on /api. Tighter route-level limits added later for AI calls.
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 240,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use("/api/profile", profileRouter);
  app.use("/api/careers", careersRouter);
  app.use("/api/action-plans", actionPlansRouter);
  app.use("/api/opportunities", opportunitiesRouter);
  app.use("/api/me", meRouter);
  app.use("/api/networking", networkingRouter);

  // 404 fallback for unmatched /api/*
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
  });

  // Central error handler — last middleware in the chain.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    req.log?.error({ err }, "unhandled error");
    if (res.headersSent) return;
    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      error: {
        code: "internal",
        message: "Something went wrong.",
        details: isDev ? String(err) : undefined,
      },
    });
  });

  return app;
}

export function startServer() {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    logger.info({ port, origin: process.env.CORS_ORIGIN }, "API listening");
  });
  return app;
}
