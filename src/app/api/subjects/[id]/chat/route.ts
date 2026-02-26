import { z } from "zod";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { buildChatResponse, resolveEffectiveQuestion } from "@/lib/chat";
import { retrieveRelevantChunks } from "@/lib/retrieval";
import { mapChunkDocsToRecords } from "@/lib/chunks";
import { SubjectModel } from "@/models/Subject";
import { ChunkModel } from "@/models/Chunk";
import type { ChatTurn } from "@/lib/types";

const chatSchema = z.object({
  question: z.string().trim().min(2).max(1200),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(2000),
      }),
    )
    .max(12)
    .optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const payload = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid question" }, { status: 400 });
  }

  const { id } = await context.params;
  const subject = await SubjectModel.findOne({ _id: id, userId: user._id });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const chunkDocs = await ChunkModel.find({
    userId: user._id,
    subjectId: subject._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  const chunks = mapChunkDocsToRecords(chunkDocs);

  const history = (parsed.data.history ?? []) as ChatTurn[];
  const effectiveQuestion = await resolveEffectiveQuestion({
    question: parsed.data.question,
    history,
  });

  const retrieved = await retrieveRelevantChunks({
    query: effectiveQuestion,
    subjectId: subject._id.toString(),
    chunks,
    topK: 8,
  });

  const result = await buildChatResponse({
    question: parsed.data.question,
    effectiveQuestion,
    history,
    subjectName: subject.name,
    retrievedChunks: retrieved,
  });

  return NextResponse.json(result);
}
