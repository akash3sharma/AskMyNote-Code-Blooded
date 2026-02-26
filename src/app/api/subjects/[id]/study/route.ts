import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { generateStudyPack, type StudyDifficultyInput } from "@/lib/study";
import { mapChunkDocsToRecords } from "@/lib/chunks";
import { tokenize } from "@/lib/utils";
import { SubjectModel } from "@/models/Subject";
import { ChunkModel } from "@/models/Chunk";

function studyScore(text: string) {
  const uniqueTerms = new Set(tokenize(text)).size;
  return Math.min(1, 0.2 + uniqueTerms / 100);
}

function parseDifficulty(value: string | null): StudyDifficultyInput | null {
  if (!value) return "medium";
  const normalized = value.trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }
  return null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const url = new URL(request.url);
  const difficulty = parseDifficulty(url.searchParams.get("difficulty"));
  if (!difficulty) {
    return NextResponse.json({ error: "Invalid difficulty. Use easy, medium, or hard." }, { status: 400 });
  }
  const variation = url.searchParams.get("variation")?.trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
    return NextResponse.json({ error: "Upload notes first to generate study mode." }, { status: 400 });
  }

  const retrieved = mapChunkDocsToRecords(chunkDocs)
    .map((chunk) => ({
      ...chunk,
      score: studyScore(chunk.text),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 16);

  const study = await generateStudyPack(retrieved, difficulty, variation);
  if (!study) {
    return NextResponse.json({ error: "Not enough note evidence to generate study mode." }, { status: 400 });
  }

  return NextResponse.json(study);
}
