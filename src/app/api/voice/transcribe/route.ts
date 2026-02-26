import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { isLLMEnabled } from "@/lib/env";
import { transcribeAudioWithLLM } from "@/lib/llm";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function resolveAudioFormat(file: File) {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const source = `${mime} ${name}`;

  if (source.includes("wav")) return "wav";
  if (source.includes("mp3") || source.includes("mpeg")) return "mp3";
  if (source.includes("ogg") || source.includes("opus")) return "ogg";
  if (source.includes("m4a") || source.includes("mp4")) return "m4a";
  if (source.includes("webm")) return "webm";
  return "wav";
}

export async function POST(request: Request) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  if (!isLLMEnabled()) {
    return NextResponse.json({ error: "Voice transcription requires an LLM API key." }, { status: 400 });
  }

  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Please provide an audio recording." }, { status: 400 });
  }

  if (audio.size <= 0) {
    return NextResponse.json({ error: "Audio recording is empty." }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio recording is too large. Keep it under 12MB." }, { status: 400 });
  }

  const audioBuffer = Buffer.from(await audio.arrayBuffer());
  const result = await transcribeAudioWithLLM({
    audioBase64: audioBuffer.toString("base64"),
    format: resolveAudioFormat(audio),
  });

  if (!result.text) {
    return NextResponse.json({ error: result.error || "Could not transcribe audio." }, { status: 502 });
  }

  return NextResponse.json({ text: result.text });
}
