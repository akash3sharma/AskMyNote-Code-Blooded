import { z } from "zod";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { buildPlannerPayload } from "@/lib/boost";
import { retrieveRelevantChunks } from "@/lib/retrieval";
import { mapChunkDocsToRecords } from "@/lib/chunks";
import { SubjectModel } from "@/models/Subject";
import { ChunkModel } from "@/models/Chunk";

const plannerSchema = z.object({
  goalMinutes: z.number().int().min(15).max(240).default(45),
  focus: z.string().trim().min(2).max(600).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const payload = await request.json().catch(() => ({}));
  const parsed = plannerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid planner input." }, { status: 400 });
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
    return NextResponse.json({ error: "Upload notes first to generate a planner." }, { status: 400 });
  }

  const chunks = mapChunkDocsToRecords(chunkDocs);

  const focusQuery = parsed.data.focus?.trim() || "most important concepts and key exam topics";
  const retrieved = await retrieveRelevantChunks({
    query: focusQuery,
    subjectId: subject._id.toString(),
    chunks,
    topK: 10,
  });

  const planner = await buildPlannerPayload({
    goalMinutes: parsed.data.goalMinutes,
    focus: parsed.data.focus?.trim(),
    retrievedChunks: retrieved,
  });

  if (!planner) {
    return NextResponse.json({ error: "Not enough evidence to build a planner." }, { status: 400 });
  }

  return NextResponse.json(planner);
}
