// One-shot CLI: embed every catalog opportunity and upsert to Pinecone.
// Run via: npx tsx src/scripts/seedPineconeOpportunities.ts [--force]
//
// The route handler also seeds lazily on first /match call, so this script
// is mostly for predictable cold-start reseeds (e.g. after editing the
// catalog) without needing to hit the API first.

import "@/load-env";
import { isEnabled, seedOpportunities } from "@/services/vector/pinecone";

async function main() {
  if (!isEnabled()) {
    console.error(
      "[seed] PINECONE_API_KEY or PINECONE_INDEX is missing. Aborting.",
    );
    process.exit(1);
  }

  const force = process.argv.includes("--force");
  console.log(`[seed] Starting opportunity seed (force=${force})...`);
  const result = await seedOpportunities({ force });
  console.log("[seed] Done:", result);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
