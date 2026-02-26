import { NextResponse } from "next/server";

import { env, isDemoMode } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    mode: isDemoMode() ? "demo" : "llm",
    provider: env.LLM_PROVIDER,
    llmEnabled: !isDemoMode(),
  });
}
