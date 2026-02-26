import { describe, expect, it } from "vitest";

import { buildReviewCardsFromChunks, scheduleNextReview } from "@/lib/review";

describe("review scheduling", () => {
  it("promotes intervals with repeated good ratings", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const first = scheduleNextReview({ repetitions: 0, intervalDays: 0, easeFactor: 2.5, lapses: 0 }, "good", now);
    const second = scheduleNextReview(first, "good", now);

    expect(first.repetitions).toBe(1);
    expect(first.intervalDays).toBe(1);
    expect(second.repetitions).toBe(2);
    expect(second.intervalDays).toBe(6);
  });

  it("resets short-term on again and increments lapses", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const result = scheduleNextReview({ repetitions: 3, intervalDays: 10, easeFactor: 2.6, lapses: 1 }, "again", now);

    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(0);
    expect(result.lapses).toBe(2);
    expect(result.dueAt.toISOString()).toBe("2026-01-01T00:10:00.000Z");
  });
});

describe("review card generation", () => {
  it("creates prompt-answer cards from chunks", () => {
    const cards = buildReviewCardsFromChunks([
      {
        chunkId: "chunk-1",
        fileName: "bio.txt",
        pageOrSection: "Section 1",
        text: "Learning is a relatively permanent change in behavior due to practice and experience.",
      },
    ]);

    expect(cards.length).toBe(1);
    expect(cards[0].chunkId).toBe("chunk-1");
    expect(cards[0].prompt.length).toBeGreaterThan(10);
    expect(cards[0].answer.toLowerCase()).toContain("learning");
  });
});

