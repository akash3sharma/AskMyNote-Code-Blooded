import { z } from "zod";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { NoteFileModel } from "@/models/NoteFile";
import { SubjectModel } from "@/models/Subject";

const createSubjectSchema = z.object({
  name: z.string().trim().min(2).max(64),
});

export async function GET() {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const subjects = await SubjectModel.find({ userId: user._id }).sort({ slot: 1 }).lean();
  const fileStats = await NoteFileModel.aggregate<{ _id: string; count: number }>([
    { $match: { userId: user._id } },
    { $group: { _id: "$subjectId", count: { $sum: 1 } } },
  ]);
  const fileCountMap = new Map(fileStats.map((entry) => [entry._id.toString(), entry.count]));

  return NextResponse.json({
    subjects: subjects.map((subject) => ({
      id: subject._id,
      name: subject.name,
      slot: subject.slot,
      fileCount: fileCountMap.get(subject._id.toString()) ?? 0,
      createdAt: subject.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const payload = await request.json().catch(() => null);
  const parsed = createSubjectSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a subject name (2-64 chars)" }, { status: 400 });
  }

  const existing = await SubjectModel.find({ userId: user._id }).sort({ slot: 1 });
  if (existing.length >= 3) {
    return NextResponse.json({ error: "You can only create exactly 3 subjects." }, { status: 400 });
  }

  const usedSlots = new Set(existing.map((item) => item.slot));
  const slot = [1, 2, 3].find((candidate) => !usedSlots.has(candidate));

  if (!slot) {
    return NextResponse.json({ error: "You can only create exactly 3 subjects." }, { status: 400 });
  }

  try {
    const created = await SubjectModel.create({
      userId: user._id,
      name: parsed.data.name,
      slot,
    });

    return NextResponse.json(
      {
        subject: {
          id: created._id,
          name: created.name,
          slot: created.slot,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Subject already exists or slot conflict" }, { status: 409 });
  }
}
