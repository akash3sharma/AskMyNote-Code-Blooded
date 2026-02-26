import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api";
import { mapChunkDocsToRecords } from "@/lib/chunks";
import { buildReviewCardsFromChunks } from "@/lib/review";
import { invalidReviewCardFilter, reviewCardBaseFilter, toReviewCardPayload } from "@/lib/review-cards";
import { SubjectModel } from "@/models/Subject";
import { ChunkModel } from "@/models/Chunk";
import { ReviewCardModel } from "@/models/ReviewCard";

const seedSchema = z.object({
  target: z.number().int().min(5).max(80).default(40),
});

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

async function getReviewQueue(userId: string, subjectId: string, limit: number) {
  await ReviewCardModel.deleteMany(invalidReviewCardFilter(userId, subjectId));

  const now = new Date();
  const today = startOfToday();
  const baseFilter = reviewCardBaseFilter(userId, subjectId);

  const [dueDocs, totalCards, dueCount, reviewedToday, nextDue] = await Promise.all([
    ReviewCardModel.find({
      ...baseFilter,
      dueAt: { $lte: now },
    })
      .sort({ dueAt: 1, updatedAt: 1 })
      .limit(limit)
      .lean(),
    ReviewCardModel.countDocuments(baseFilter),
    ReviewCardModel.countDocuments({ ...baseFilter, dueAt: { $lte: now } }),
    ReviewCardModel.countDocuments({ ...baseFilter, lastReviewedAt: { $gte: today } }),
    ReviewCardModel.findOne({ ...baseFilter, dueAt: { $gt: now } }).sort({ dueAt: 1 }).lean(),
  ]);

  return {
    stats: {
      totalCards,
      dueCount,
      reviewedToday,
      nextDueAt: nextDue?.dueAt ? new Date(nextDue.dueAt).toISOString() : null,
    },
    dueCards: dueDocs.map((card) => toReviewCardPayload(card)),
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const { id } = await context.params;
  const subject = await SubjectModel.findOne({ _id: id, userId: user._id });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || "15")));

  const queue = await getReviewQueue(user._id.toString(), subject._id.toString(), limit);
  return NextResponse.json(queue);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser();
  if (error || !user) return error;

  const payload = await request.json().catch(() => ({}));
  const parsed = seedSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deck target." }, { status: 400 });
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
    return NextResponse.json({ error: "Upload notes first to create a review deck." }, { status: 400 });
  }

  const chunks = mapChunkDocsToRecords(chunkDocs);
  await ReviewCardModel.deleteMany(invalidReviewCardFilter(user._id.toString(), subject._id.toString()));

  const baseFilter = reviewCardBaseFilter(user._id.toString(), subject._id.toString());
  const existingChunkIds = new Set(
    (await ReviewCardModel.find(baseFilter).distinct("chunkId")).filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  const available = chunks.filter((chunk) => !existingChunkIds.has(chunk.chunkId));

  const cards = buildReviewCardsFromChunks(available, parsed.data.target);
  let createdCards = 0;

  if (cards.length > 0) {
    const result = await ReviewCardModel.bulkWrite(
      cards.map((card) => ({
        updateOne: {
          filter: { userId: user._id, subjectId: subject._id, chunkId: card.chunkId },
          update: {
            $setOnInsert: {
              ...card,
              dueAt: new Date(),
              repetitions: 0,
              intervalDays: 0,
              easeFactor: 2.5,
              lapses: 0,
              reviewCount: 0,
              lastRating: null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    createdCards = result.upsertedCount || 0;
  }

  const queue = await getReviewQueue(user._id.toString(), subject._id.toString(), 15);

  return NextResponse.json({
    createdCards,
    ...queue,
  });
}
