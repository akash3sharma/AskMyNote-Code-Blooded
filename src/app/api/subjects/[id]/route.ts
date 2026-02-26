import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";
import { SubjectModel } from "@/models/Subject";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const { id } = await context.params;
  const subject = await SubjectModel.findOne({ _id: id, userId: user._id }).lean();

  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  return NextResponse.json({
    subject: {
      id: subject._id,
      name: subject.name,
      slot: subject.slot,
      createdAt: subject.createdAt,
    },
  });
}
