import OpenAI from "openai";

import { env, resolveApiKey } from "@/lib/env";
import { tokenize } from "@/lib/utils";

const LOCAL_EMBED_DIM = 256;

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function hashToken(token: string) {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function localEmbedding(text: string, dimension = LOCAL_EMBED_DIM) {
  const tokens = tokenize(text);
  const resolvedDim = Math.max(8, Math.floor(dimension));
  const vector = new Array<number>(resolvedDim).fill(0);

  for (const token of tokens) {
    const base = hashToken(token);
    const idx = base % resolvedDim;
    vector[idx] += 1;

    // Spread token signal to nearby bins for better lexical recall.
    vector[(idx + 13) % resolvedDim] += 0.4;
    vector[(idx + 37) % resolvedDim] += 0.2;
  }

  return normalizeVector(vector);
}

let cachedClient: OpenAI | null | undefined;

function getClient() {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const key = resolveApiKey();
  if (!key) {
    cachedClient = null;
    return cachedClient;
  }

  if (env.LLM_PROVIDER === "openrouter") {
    cachedClient = new OpenAI({
      apiKey: key,
      baseURL: env.OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": env.APP_URL,
        "X-Title": "AskMyNotes",
      },
    });
  } else {
    cachedClient = new OpenAI({ apiKey: key });
  }

  return cachedClient;
}

export async function createEmbeddings(texts: string[]) {
  if (texts.length === 0) return [];

  const client = getClient();
  if (!client) {
    return texts.map((text) => localEmbedding(text));
  }

  try {
    const response = await client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  } catch {
    return texts.map((text) => localEmbedding(text));
  }
}

export async function embedQuery(text: string) {
  const [embedding] = await createEmbeddings([text]);
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
