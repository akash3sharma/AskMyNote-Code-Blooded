import { z } from "zod";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { buildExplainPayload } from "@/lib/boost";
import { retrieveRelevantChunks } from "@/lib/retrieval";
import { mapChunkDocsToRecords } from "@/lib/chunks";
import { SubjectModel } from "@/models/Subject";
import { ChunkModel } from "@/models/Chunk";

const explainSchema = z.object({
  concept: z.string().trim().min(2).max(600),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const payload = await request.json().catch(() => null);
  const parsed = explainSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid concept." }, { status: 400 });
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

  if (chunkDocs.length === 0) {
    return NextResponse.json({ error: "Upload notes first to use concept explainer." }, { status: 400 });
  }

  const chunks = mapChunkDocsToRecords(chunkDocs);

  const retrieved = await retrieveRelevantChunks({
    query: parsed.data.concept,
    subjectId: subject._id.toString(),
    chunks,
    topK: 8,
  });

  const result = await buildExplainPayload({
    concept: parsed.data.concept,
    subjectName: subject.name,
    retrievedChunks: retrieved,
  });

  return NextResponse.json(result);
}
