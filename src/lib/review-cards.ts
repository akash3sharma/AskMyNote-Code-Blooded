import { toObjectIdString } from "@/lib/utils";
import type { ReviewCardPayload } from "@/lib/types";

type IdLike = string | { toString: () => string } | null | undefined;

function idToString(value: IdLike) {
  return toObjectIdString(value);
}

export function reviewCardBaseFilter(userId: string, subjectId: string) {
  return {
    userId,
    subjectId,
    chunkId: { $type: "string", $ne: "" },
    pageOrSection: { $type: "string", $ne: "" },
    fileName: { $type: "string", $ne: "" },
    prompt: { $type: "string", $ne: "" },
    answer: { $type: "string", $ne: "" },
  } as const;
}

export function invalidReviewCardFilter(userId: string, subjectId: string) {
  return {
    userId,
    subjectId,
    $or: [
      { chunkId: { $exists: false } },
      { chunkId: null },
      { chunkId: "" },
      { pageOrSection: { $exists: false } },
      { pageOrSection: null },
      { pageOrSection: "" },
      { fileName: { $exists: false } },
      { fileName: null },
      { fileName: "" },
      { prompt: { $exists: false } },
      { prompt: null },
      { prompt: "" },
      { answer: { $exists: false } },
      { answer: null },
      { answer: "" },
    ],
  } as const;
}

export function toReviewCardPayload(card: {
  _id?: IdLike;
  chunkId?: string | null;
  fileName?: string | null;
  pageOrSection?: string | null;
  prompt?: string | null;
  answer?: string | null;
  evidenceSnippet?: string | null;
  dueAt?: Date | string | null;
  repetitions?: number | null;
  intervalDays?: number | null;
  easeFactor?: number | null;
  lapses?: number | null;
  reviewCount?: number | null;
  lastRating?: "again" | "hard" | "good" | "easy" | null;
}): ReviewCardPayload {
  const dueAtDate = card.dueAt ? new Date(card.dueAt) : new Date();
  return {
    id: idToString(card._id),
    chunkId: card.chunkId || "",
    fileName: card.fileName || "Unknown file",
    pageOrSection: card.pageOrSection || "Unknown section",
    prompt: card.prompt || "Review this concept.",
    answer: card.answer || "",
    evidenceSnippet: card.evidenceSnippet || "",
    dueAt: Number.isNaN(dueAtDate.getTime()) ? new Date().toISOString() : dueAtDate.toISOString(),
    repetitions: card.repetitions || 0,
    intervalDays: card.intervalDays || 0,
    easeFactor: Number(card.easeFactor || 2.5),
    lapses: card.lapses || 0,
    reviewCount: card.reviewCount || 0,
    lastRating: card.lastRating || null,
  };
}

