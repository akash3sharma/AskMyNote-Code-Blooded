import { z } from "zod";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { buildSearchPayload } from "@/lib/boost";
import { retrieveRelevantChunks } from "@/lib/retrieval";
import { mapChunkDocsToRecords } from "@/lib/chunks";
import { SubjectModel } from "@/models/Subject";
import { ChunkModel } from "@/models/Chunk";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(1000),
  limit: z.number().int().min(1).max(20).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const payload = await request.json().catch(() => null);
  const parsed = searchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid search query." }, { status: 400 });
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
    return NextResponse.json({ error: "Upload notes first to use smart search." }, { status: 400 });
  }

  const chunks = mapChunkDocsToRecords(chunkDocs);

  const retrieved = await retrieveRelevantChunks({
    query: parsed.data.query,
    subjectId: subject._id.toString(),
    chunks,
    topK: Math.max(parsed.data.limit ?? 8, 8),
  });

  const result = buildSearchPayload({
    query: parsed.data.query,
    retrievedChunks: retrieved,
    limit: parsed.data.limit ?? 8,
  });

  return NextResponse.json(result);
}
