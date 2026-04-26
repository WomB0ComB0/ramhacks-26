import { GoogleGenAI, Type, type Model } from "@google/genai";
import { CareerMatchResponse, ActionPlanResponse } from "./schemas";
import { buildCareerPrompt, CAREER_SYSTEM, type ProfileForPrompt } from "./prompts/career";
import {
  ACTION_PLAN_SYSTEM,
  buildActionPlanPrompt,
  type ActionPlanContext,
} from "./prompts/actionPlan";

// Adapted from Mike Odnis' GeminiService pattern:
//   - Auto-discovers available models via genAI.models.list() (cached)
//   - Tier-sorted fallback (flash-lite -> flash -> pro), newer first
//   - Falls through on 404 / rate-limit so we never hard-code dead models

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set. Add it to .env.");
}

const HARDCODED_DEFAULTS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

const genAI = new GoogleGenAI({ apiKey });

let cachedModels: string[] | null = null;

async function fetchAvailableModels(): Promise<string[]> {
  if (cachedModels) return cachedModels;
  try {
    const pager = await genAI.models.list();
    const all: Model[] = [];
    for await (const m of pager) all.push(m);
    const names = all
      .filter((m) => m.name && m.supportedActions?.includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""));
    cachedModels = names;
    return names;
  } catch (e) {
    console.warn(
      "[gemini] models.list() failed; using hardcoded defaults:",
      String((e as Error).message ?? e).slice(0, 200),
    );
    return [];
  }
}

function parseModelVersion(name: string): number {
  const m = /(\d+)\.(\d+)/.exec(name);
  return m ? Number(m[1]) * 1000 + Number(m[2]) : 0;
}

function tierOf(name: string): number {
  if (name.includes("flash-lite")) return 0;
  if (name.includes("flash")) return 1;
  if (name.includes("pro")) return 2;
  return 3;
}

async function getModelFallbackChain(preferred?: string): Promise<string[]> {
  const available = await fetchAvailableModels();
  const ranked = available
    .filter(
      (m) =>
        !m.includes("embedding") &&
        !m.includes("aqa") &&
        !m.includes("imagen") &&
        !m.includes("veo") &&
        !m.includes("tts") &&
        !m.includes("native-audio") &&
        !m.includes("preview"),
    )
    .sort((a, b) => {
      const t = tierOf(a) - tierOf(b);
      return t !== 0 ? t : parseModelVersion(b) - parseModelVersion(a);
    });

  const base = ranked.length > 0 ? ranked : HARDCODED_DEFAULTS;
  if (preferred) return [preferred, ...base.filter((m) => m !== preferred)];
  return base;
}

function isRateLimitError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("resource exhausted") ||
    msg.includes("quota")
  );
}

function isModelMissingError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? "").toLowerCase();
  return msg.includes("404") || msg.includes("not found") || msg.includes("not supported");
}

const careerResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    reasoning: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
    safetyNotes: { type: Type.STRING },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          fitReason: { type: Type.STRING },
          requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedProjects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                outline: { type: Type.STRING },
                estTimeWeeks: { type: Type.NUMBER },
              },
              required: ["name", "outline"],
            },
          },
          entryRoles: { type: Type.ARRAY, items: { type: Type.STRING } },
          growthPath: { type: Type.ARRAY, items: { type: Type.STRING } },
          difficulty: {
            type: Type.STRING,
            enum: ["easy", "moderate", "hard", "very_hard"],
          },
          confidence: { type: Type.NUMBER },
          tradeoffs: { type: Type.STRING },
        },
        required: [
          "title",
          "fitReason",
          "requiredSkills",
          "missingSkills",
          "suggestedProjects",
          "entryRoles",
          "growthPath",
          "difficulty",
          "confidence",
          "tradeoffs",
        ],
      },
    },
  },
  required: ["summary", "recommendations", "reasoning", "confidence", "nextSteps"],
} as const;

export interface CareerGenerateOptions {
  limit?: number;
  focus?: string;
}

export async function generateCareerMatches(
  profile: ProfileForPrompt,
  opts: CareerGenerateOptions = {},
): Promise<CareerMatchResponse> {
  const userPrompt = buildCareerPrompt(profile, opts);
  const models = await getModelFallbackChain(process.env.GEMINI_MODEL);

  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i]!;
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: CAREER_SYSTEM,
          temperature: 0.4,
          // Career schema is recommendations[] with nested arrays — 4K easily
          // truncates mid-JSON (parse error at pos ~10K). 2.5-flash supports
          // up to 65K output tokens; 16K gives headroom without burning budget.
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
          responseSchema: careerResponseSchema,
        },
      });

      const finishReason = result.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP") {
        console.warn(`[gemini] ${modelName} finishReason=${finishReason} (likely truncated)`);
      }

      const text = result.text;
      if (!text) {
        throw new Error("Gemini returned empty content");
      }

      const parsed = JSON.parse(text) as unknown;
      const validated = CareerMatchResponse.parse(parsed);
      if (validated.confidence > 0.9) {
        validated.confidence = 0.85;
        validated.safetyNotes =
          (validated.safetyNotes ?? "") +
          " Confidence clamped to 0.85 - model overconfidence guard.";
      }
      if (i > 0) console.warn(`[gemini] succeeded on fallback model ${modelName}`);
      return validated;
    } catch (err) {
      lastError = err;
      const msg = String((err as Error)?.message ?? err).slice(0, 300);
      console.error(`[gemini] ${modelName} failed: ${msg}`);
      const next = models[i + 1];
      if ((isRateLimitError(err) || isModelMissingError(err)) && next) {
        console.warn(`[gemini] falling through to ${next}`);
        continue;
      }
      if (!isRateLimitError(err) && !isModelMissingError(err)) {
        throw new Error(`Gemini career generation failed (${modelName}): ${msg}`);
      }
    }
  }

  throw new Error(
    `All Gemini models exhausted [${models.slice(0, 5).join(", ")}...]: ${String(
      (lastError as Error)?.message ?? lastError,
    )}`,
  );
}

// ---------- Action Plan ----------

const actionStepSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING },
    why: { type: Type.STRING },
    estTimeHours: { type: Type.NUMBER },
    difficulty: {
      type: Type.STRING,
      enum: ["easy", "moderate", "hard"],
    },
    expectedOutcome: { type: Type.STRING },
    successCriteria: { type: Type.STRING },
    resources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          url: { type: Type.STRING },
        },
        required: ["label"],
      },
    },
  },
  required: [
    "action",
    "why",
    "estTimeHours",
    "difficulty",
    "expectedOutcome",
    "successCriteria",
  ],
} as const;

const actionPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    safetyNotes: { type: Type.STRING },
    sevenDayPlan: { type: Type.ARRAY, items: actionStepSchema },
    thirtyDayPlan: { type: Type.ARRAY, items: actionStepSchema },
    ninetyDayPlan: { type: Type.ARRAY, items: actionStepSchema },
    sixMonthPlan: { type: Type.ARRAY, items: actionStepSchema },
    longTermPlan: { type: Type.ARRAY, items: actionStepSchema },
  },
  required: [
    "summary",
    "sevenDayPlan",
    "thirtyDayPlan",
    "ninetyDayPlan",
    "sixMonthPlan",
    "longTermPlan",
    "confidence",
  ],
} as const;

export async function generateActionPlan(
  ctx: ActionPlanContext,
): Promise<ActionPlanResponse> {
  const userPrompt = buildActionPlanPrompt(ctx);
  const models = await getModelFallbackChain(process.env.GEMINI_MODEL);

  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i]!;
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: ACTION_PLAN_SYSTEM,
          temperature: 0.3,
          // Action plan schema is 5 horizons × N steps × resources — even
          // larger than career. 16K is safe; 2.5-flash supports up to 65K.
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
          responseSchema: actionPlanResponseSchema,
        },
      });

      const finishReason = result.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== "STOP") {
        console.warn(`[gemini-plan] ${modelName} finishReason=${finishReason} (likely truncated)`);
      }

      const text = result.text;
      if (!text) throw new Error("Gemini returned empty content");

      const parsed = JSON.parse(text) as unknown;
      const validated = ActionPlanResponse.parse(parsed);
      if (validated.confidence > 0.9) {
        validated.confidence = 0.85;
        validated.safetyNotes =
          (validated.safetyNotes ?? "") +
          " Confidence clamped to 0.85 - model overconfidence guard.";
      }
      if (i > 0) console.warn(`[gemini-plan] succeeded on fallback model ${modelName}`);
      return validated;
    } catch (err) {
      lastError = err;
      const msg = String((err as Error)?.message ?? err).slice(0, 300);
      console.error(`[gemini-plan] ${modelName} failed: ${msg}`);
      const next = models[i + 1];
      if ((isRateLimitError(err) || isModelMissingError(err)) && next) {
        console.warn(`[gemini-plan] falling through to ${next}`);
        continue;
      }
      if (!isRateLimitError(err) && !isModelMissingError(err)) {
        throw new Error(`Gemini action plan generation failed (${modelName}): ${msg}`);
      }
    }
  }

  throw new Error(
    `All Gemini models exhausted [${models.slice(0, 5).join(", ")}...]: ${String(
      (lastError as Error)?.message ?? lastError,
    )}`,
  );
}
