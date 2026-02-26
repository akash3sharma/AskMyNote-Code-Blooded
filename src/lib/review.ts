import { sentenceSplit, tokenize, truncate } from "@/lib/utils";

export type ReviewRating = "again" | "hard" | "good" | "easy";

type ReviewCardState = {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
};

export type ReviewCardSeedSource = {
  chunkId: string;
  fileName: string;
  pageOrSection: string;
  text: string;
};

export type ReviewCardSeed = {
  chunkId: string;
  fileName: string;
  pageOrSection: string;
  prompt: string;
  answer: string;
  evidenceSnippet: string;
};

const MIN_EASE = 1.3;
const MAX_EASE = 3.2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toQuality(rating: ReviewRating) {
  if (rating === "again") return 1;
  if (rating === "hard") return 3;
  if (rating === "good") return 4;
  return 5;
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000);
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 86_400_000);
}

export function scheduleNextReview(state: ReviewCardState, rating: ReviewRating, now = new Date()) {
  let repetitions = Math.max(0, Math.round(state.repetitions || 0));
  let intervalDays = Math.max(0, Math.round(state.intervalDays || 0));
  let easeFactor = clamp(state.easeFactor || 2.5, MIN_EASE, MAX_EASE);
  let lapses = Math.max(0, Math.round(state.lapses || 0));

  if (rating === "again") {
    lapses += 1;
    repetitions = 0;
    intervalDays = 0;
    easeFactor = clamp(easeFactor - 0.2, MIN_EASE, MAX_EASE);

    return {
      dueAt: addMinutes(now, 10),
      repetitions,
      intervalDays,
      easeFactor,
      lapses,
    };
  }

  const quality = toQuality(rating);
  let nextInterval = 1;

  if (repetitions <= 0) {
    nextInterval = rating === "easy" ? 2 : 1;
  } else if (repetitions === 1) {
    nextInterval = rating === "hard" ? 3 : rating === "easy" ? 8 : 6;
  } else {
    const base = Math.max(1, intervalDays || 1);
    const multiplier = rating === "hard" ? 0.8 : rating === "easy" ? 1.3 : 1;
    nextInterval = Math.max(1, Math.round(base * easeFactor * multiplier));
  }

  repetitions += 1;
  intervalDays = nextInterval;

  const easeAdjustment = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easeFactor = clamp(easeFactor + easeAdjustment, MIN_EASE, MAX_EASE);

  return {
    dueAt: addDays(now, intervalDays),
    repetitions,
    intervalDays,
    easeFactor,
    lapses,
  };
}

function pickKeyword(text: string) {
  const terms = tokenize(text).filter((token) => token.length >= 4);
  return terms.sort((a, b) => b.length - a.length)[0] || "concept";
}

function pickAnswerSentence(text: string) {
  const sentences = sentenceSplit(text);
  if (sentences.length === 0) {
    return truncate(text.trim(), 220);
  }

  return (
    sentences
      .filter((sentence) => sentence.length >= 24)
      .sort((a, b) => b.length - a.length)[0] || truncate(sentences[0], 220)
  );
}

function buildPrompt(sentence: string, keyword: string, index: number) {
  const hints = [
    `Explain "${keyword}" in your own words.`,
    `Recall the core idea related to "${keyword}".`,
    `What does this note imply about "${keyword}"?`,
    `State the key takeaway for "${keyword}".`,
  ];

  if (sentence.length <= 80) {
    return `Complete this memory cue: ${sentence}`;
  }

  return hints[index % hints.length];
}

export function buildReviewCardsFromChunks(chunks: ReviewCardSeedSource[], maxCards = 40): ReviewCardSeed[] {
  const cards: ReviewCardSeed[] = [];

  for (const chunk of chunks) {
    if (cards.length >= maxCards) break;
    if (!chunk.chunkId || !chunk.fileName || !chunk.pageOrSection) continue;

    const answer = pickAnswerSentence(chunk.text);
    if (!answer || answer.length < 12) continue;

    const keyword = pickKeyword(answer);
    const prompt = buildPrompt(answer, keyword, cards.length);

    cards.push({
      chunkId: chunk.chunkId,
      fileName: chunk.fileName,
      pageOrSection: chunk.pageOrSection,
      prompt,
      answer: truncate(answer, 280),
      evidenceSnippet: truncate(answer, 220),
    });
  }

  return cards;
}
