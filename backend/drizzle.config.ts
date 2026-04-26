import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Both backend and frontend read from one .env at the repo root.
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy ../.env.example to ../.env and fill it in.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  // Only manage the public schema. neon_auth.users_sync is provisioned and
  // owned by Neon Auth; never let drizzle-kit try to drop or alter it.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
