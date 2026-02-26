import { z } from "zod";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { gradeStudySubmission } from "@/lib/grading";
import { SubjectModel } from "@/models/Subject";

const gradeSchema = z.object({
  studyPack: z.object({
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    mcqs: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctOption: z.number().int().min(0).max(3),
        explanation: z.string(),
        citations: z.array(
          z.object({
            fileName: z.string(),
            pageOrSection: z.string(),
            chunkId: z.string(),
          }),
        ),
        evidence: z.array(
          z.object({
            fileName: z.string(),
            pageOrSection: z.string(),
            textSnippet: z.string(),
          }),
        ),
      }),
    ),
    shortAnswers: z.array(
      z.object({
        question: z.string(),
        modelAnswer: z.string(),
        citations: z.array(
          z.object({
            fileName: z.string(),
            pageOrSection: z.string(),
            chunkId: z.string(),
          }),
        ),
        evidence: z.array(
          z.object({
            fileName: z.string(),
            pageOrSection: z.string(),
            textSnippet: z.string(),
          }),
        ),
      }),
    ),
    flashcards: z.array(
      z.object({
        front: z.string(),
        back: z.string(),
        citations: z.array(
          z.object({
            fileName: z.string(),
            pageOrSection: z.string(),
            chunkId: z.string(),
          }),
        ),
        evidence: z.array(
          z.object({
            fileName: z.string(),
            pageOrSection: z.string(),
            textSnippet: z.string(),
          }),
        ),
      }),
    ),
  }),
  mcqAnswers: z.array(z.number().int().min(0).max(3)),
  shortAnswers: z.array(z.string()),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const { id } = await context.params;
  const subject = await SubjectModel.findOne({ _id: id, userId: user._id });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = gradeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid grading payload" }, { status: 400 });
  }

  const result = gradeStudySubmission(parsed.data);
  return NextResponse.json(result);
}
