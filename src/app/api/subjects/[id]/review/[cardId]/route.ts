import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";

import { requireUser } from "@/lib/api";
import { scheduleNextReview, type ReviewRating } from "@/lib/review";
import { invalidReviewCardFilter, reviewCardBaseFilter, toReviewCardPayload } from "@/lib/review-cards";
import { SubjectModel } from "@/models/Subject";
import { ReviewCardModel } from "@/models/ReviewCard";

const rateSchema = z.object({
  rating: z.enum(["again", "hard", "good", "easy"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string; cardId: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const payload = await request.json().catch(() => null);
  const parsed = rateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rating. Use again, hard, good, or easy." }, { status: 400 });
  }

  const { id, cardId } = await context.params;
  const subject = await SubjectModel.findOne({ _id: id, userId: user._id });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  if (!Types.ObjectId.isValid(cardId)) {
    return NextResponse.json({ error: "Review card not found" }, { status: 404 });
  }

  await ReviewCardModel.deleteMany(invalidReviewCardFilter(user._id.toString(), subject._id.toString()));
  const baseFilter = reviewCardBaseFilter(user._id.toString(), subject._id.toString());

  const card = await ReviewCardModel.findOne({
    ...baseFilter,
    _id: cardId,
  }).lean();

  if (!card) {
    return NextResponse.json({ error: "Review card not found" }, { status: 404 });
  }

  const now = new Date();
  const next = scheduleNextReview(
    {
      repetitions: card.repetitions || 0,
      intervalDays: card.intervalDays || 0,
      easeFactor: card.easeFactor || 2.5,
      lapses: card.lapses || 0,
    },
    parsed.data.rating as ReviewRating,
    now,
  );

  const updated = await ReviewCardModel.findOneAndUpdate(
    {
      ...baseFilter,
      _id: cardId,
    },
    {
      $set: {
        repetitions: next.repetitions,
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        lapses: next.lapses,
        dueAt: next.dueAt,
        lastRating: parsed.data.rating,
        lastReviewedAt: now,
      },
      $inc: {
        reviewCount: 1,
      },
    },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: "Review card not found" }, { status: 404 });
  }

  return NextResponse.json({
    card: toReviewCardPayload(updated),
  });
}
