import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { generateAiLabPack } from "@/lib/ai-lab";
import { mapChunkDocsToRecords } from "@/lib/chunks";
import { tokenize } from "@/lib/utils";
import { SubjectModel } from "@/models/Subject";
import { ChunkModel } from "@/models/Chunk";

function richnessScore(text: string) {
  const uniqueTerms = new Set(tokenize(text)).size;
  return Math.min(1, 0.2 + uniqueTerms / 110);
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

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
    return NextResponse.json({ error: "Upload notes first to unlock AI Lab." }, { status: 400 });
  }

  const chunks = mapChunkDocsToRecords(chunkDocs)
    .map((chunk) => ({
      ...chunk,
      score: richnessScore(chunk.text),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);

  const labPack = await generateAiLabPack(chunks);
  if (!labPack) {
    return NextResponse.json({ error: "Not enough note evidence to generate AI Lab." }, { status: 400 });
  }

  return NextResponse.json(labPack);
}
