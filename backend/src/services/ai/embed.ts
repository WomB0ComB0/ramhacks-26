import { GoogleGenAI } from "@google/genai";

// Gemini embedding wrapper. Used by the vector layer to embed user profiles
// (query side) and the opportunity catalog (seed side).

const apiKey = process.env.GEMINI_API_KEY;
// Gemini deprecated `text-embedding-004` for new keys; current stable GA
// model is `gemini-embedding-001` (returns 768/1536/3072-dim vectors).
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";

let cached: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!cached) {
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set; cannot embed.");
    cached = new GoogleGenAI({ apiKey });
  }
  return cached;
}

// gemini-embedding-001 returns 3072-dim vectors by default, but supports
// Matryoshka truncation to smaller sizes (e.g. 1024 to match an existing
// Pinecone index). Set GEMINI_EMBED_DIM env var to truncate; omit for default.
const EMBED_DIM = process.env.GEMINI_EMBED_DIM
  ? Number(process.env.GEMINI_EMBED_DIM)
  : undefined;

/**
 * Embed a batch of strings. Returns one vector per input, in order.
 *
 * The Gemini SDK accepts contents as string | string[] | Part[]. We pass an
 * array and unwrap response.embeddings[].values back into number[][].
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await client().models.embedContent({
    model: EMBED_MODEL,
    contents: texts,
    ...(EMBED_DIM ? { config: { outputDimensionality: EMBED_DIM } } : {}),
  });

  const out = (res.embeddings ?? []).map((e) => e.values ?? []);
  if (out.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: requested ${texts.length}, received ${out.length}`,
    );
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec ?? [];
}
