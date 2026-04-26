// Side-effect-only module: must be the FIRST import of backend/src/index.ts.
// TypeScript hoists ES imports above top-level statements, so an inline
// `loadEnv()` call in index.ts runs AFTER `./server` is required — which is
// too late, because middleware/auth.ts reads process.env at module load.
// Putting the load here guarantees declaration-order evaluation: load-env
// resolves before server, so env vars are populated when downstream modules
// initialize.

import path from "node:path";
import fs from "node:fs";
import { config as loadEnv } from "dotenv";

const envPath = path.resolve(__dirname, "..", "..", ".env");

if (!fs.existsSync(envPath)) {
  console.error(`[load-env] .env not found at ${envPath}`);
} else {
  const result = loadEnv({ path: envPath });
  if (result.error) {
    console.error(`[load-env] dotenv failed for ${envPath}:`, result.error);
  } else {
    const count = Object.keys(result.parsed ?? {}).length;
    console.log(`[load-env] loaded ${count} vars from ${envPath}`);
  }
}
