import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(12).default("askmynotes-dev-secret-key"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/askmynotes"),
  LLM_PROVIDER: z.enum(["openai", "openrouter"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  VOICE_INPUT_MODEL: z.string().optional(),
  UPLOAD_DIR: z.string().default("data/uploads"),
  RETRIEVAL_THRESHOLD: z.coerce.number().default(0.2),
  RETRIEVAL_MIN_CHUNKS: z.coerce.number().int().default(2),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;

export function resolveApiKey() {
  if (env.LLM_PROVIDER === "openai") {
    return env.OPENAI_API_KEY?.trim() || "";
  }

  return env.OPENROUTER_API_KEY?.trim() || "";
}

export function isDemoMode() {
  return !resolveApiKey();
}

export function isLLMEnabled() {
  return !isDemoMode();
}
