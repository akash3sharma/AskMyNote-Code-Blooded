import OpenAI from "openai";

import { env, resolveApiKey } from "@/lib/env";

let cachedClient: OpenAI | null | undefined;

export function getLLMClient() {
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

export async function completeWithLLM(params: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}) {
  const client = getLLMClient();
  if (!client) {
    return null;
  }

  try {
    const completion = await client.chat.completions.create({
      model: env.LLM_MODEL,
      temperature: params.temperature ?? 0.2,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

function parseCompletionText(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part !== "object" || part === null) return "";
        const maybeText = part as { type?: string; text?: string };
        if (maybeText.type === "text" && typeof maybeText.text === "string") {
          return maybeText.text;
        }
        return "";
      })
      .filter(Boolean);

    return textParts.join(" ").trim();
  }

  return "";
}

function normalizeAudioFormat(format: string) {
  const lower = format.toLowerCase();
  if (lower.includes("wav")) return "wav";
  if (lower.includes("mp3") || lower.includes("mpeg")) return "mp3";
  if (lower.includes("ogg") || lower.includes("opus")) return "ogg";
  if (lower.includes("m4a") || lower.includes("mp4")) return "m4a";
  if (lower.includes("webm")) return "webm";
  return "wav";
}

function transcribeModel() {
  if (env.VOICE_INPUT_MODEL?.trim()) {
    return env.VOICE_INPUT_MODEL.trim();
  }

  if (env.LLM_PROVIDER === "openrouter") {
    return "openai/gpt-audio-mini";
  }

  return "gpt-4o-mini-transcribe";
}

function baseApiUrl() {
  if (env.LLM_PROVIDER === "openrouter") {
    return env.OPENROUTER_BASE_URL;
  }

  return "https://api.openai.com/v1";
}

export async function transcribeAudioWithLLM(params: { audioBase64: string; format: string }) {
  const key = resolveApiKey();
  if (!key) {
    return {
      text: null as string | null,
      error: "Voice transcription is unavailable in Demo Mode.",
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  if (env.LLM_PROVIDER === "openrouter") {
    headers["HTTP-Referer"] = env.APP_URL;
    headers["X-Title"] = "AskMyNotes";
  }

  const response = await fetch(`${baseApiUrl()}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: transcribeModel(),
      modalities: ["text"],
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Transcribe user audio to plain text. Return transcript only.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this audio." },
            {
              type: "input_audio",
              input_audio: {
                data: params.audioBase64,
                format: normalizeAudioFormat(params.format),
              },
            },
          ],
        },
      ],
    }),
  }).catch(() => null);

  if (!response) {
    return {
      text: null as string | null,
      error: "Voice transcription request failed. Check network and retry.",
    };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } } | null)?.error?.message || "Voice transcription failed.";
    return {
      text: null as string | null,
      error: message,
    };
  }

  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices?.[0]?.message
    ?.content;
  const text = parseCompletionText(content);

  if (!text) {
    return {
      text: null as string | null,
      error: "No speech detected in the recording.",
    };
  }

  return { text, error: null as string | null };
}

export async function ocrImageWithLLM(params: { imageDataUrl: string; pageNumber: number }) {
  const client = getLLMClient();
  if (!client) {
    return null;
  }

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You extract text from document page images. Return plain text only. If no readable text, reply exactly EMPTY.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract all readable text from page ${params.pageNumber}. Preserve sentence order.`,
          },
          {
            type: "image_url",
            image_url: {
              url: params.imageDataUrl,
            },
          },
        ],
      },
    ];

    const completion = await client.chat.completions.create({
      model: env.LLM_MODEL,
      temperature: 0,
      messages,
      max_tokens: 1800,
    });

    const content = completion.choices[0]?.message?.content?.trim() || "";
    if (!content || /^EMPTY$/i.test(content)) {
      return "";
    }
    return content;
  } catch {
    return null;
  }
}
