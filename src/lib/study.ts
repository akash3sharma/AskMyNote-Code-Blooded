import { isDemoMode } from "@/lib/env";
import { completeWithLLM } from "@/lib/llm";
import { tokenize, truncate } from "@/lib/utils";
import type { RetrievedChunk, StudyDifficulty, StudyResponsePayload } from "@/lib/types";

export type StudyDifficultyInput = "easy" | "medium" | "hard";

const DIFFICULTY_LABEL: Record<StudyDifficultyInput, StudyDifficulty> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 123456789;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffleWithRng<T>(items: T[], nextRandom: () => number) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRandom() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function pickTemplate(templates: string[], index: number, nextRandom: () => number) {
  const shuffled = shuffleWithRng(templates, nextRandom);
  return shuffled[index % shuffled.length];
}

type SourceItem = {
  sentence: string;
  chunk: RetrievedChunk;
  keyword: string;
};

function pickKeyword(sentence: string) {
  const terms = tokenize(sentence).filter((term) => term.length >= 4);
  return terms.sort((a, b) => b.length - a.length)[0] ?? "concept";
}

function getSourceItems(chunks: RetrievedChunk[], count = 10) {
  const items: SourceItem[] = [];

  for (const chunk of chunks) {
    const sentences = chunk.text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
    for (const sentence of sentences) {
      if (sentence.length < 24) continue;
      items.push({
        sentence: truncate(sentence, 220),
        chunk,
        keyword: pickKeyword(sentence),
      });
    }
  }

  return items
    .sort((a, b) => b.chunk.score - a.chunk.score || b.sentence.length - a.sentence.length)
    .slice(0, count);
}

function expandSourceItems(items: SourceItem[], target: number) {
  if (items.length === 0) return [];
  if (items.length >= target) return items.slice(0, target);

  const expanded = [...items];
  let cursor = 0;
  while (expanded.length < target) {
    expanded.push(items[cursor % items.length]);
    cursor += 1;
  }

  return expanded;
}

function attachMeta(item: SourceItem) {
  return {
    citations: [
      {
        fileName: item.chunk.fileName,
        pageOrSection: item.chunk.pageOrSection,
        chunkId: item.chunk.chunkId,
      },
    ],
    evidence: [
      {
        fileName: item.chunk.fileName,
        pageOrSection: item.chunk.pageOrSection,
        textSnippet: item.sentence,
      },
    ],
  };
}

function difficultyPromptPrefix(difficulty: StudyDifficultyInput) {
  if (difficulty === "easy") {
    return "direct definition";
  }
  if (difficulty === "hard") {
    return "application and comparison";
  }
  return "conceptual understanding";
}

function deterministicStudy(
  sourceItems: SourceItem[],
  difficulty: StudyDifficultyInput,
  variationKey: string,
): StudyResponsePayload {
  const rng = seededRandom(hashSeed(`${difficulty}:${variationKey}`));
  const expandedItems = shuffleWithRng(expandSourceItems(sourceItems, 10), rng);
  const keywords = expandedItems.map((item) => item.keyword);
  const difficultyLabel = DIFFICULTY_LABEL[difficulty];

  const mcqs = Array.from({ length: 5 }).map((_, index) => {
    const item = expandedItems[index % expandedItems.length];
    const distractors = keywords.filter((word) => word !== item.keyword).slice(index, index + 3);
    while (distractors.length < 3) {
      distractors.push(`term${distractors.length + 1}`);
    }

    const options = shuffleWithRng([item.keyword, ...distractors], rng);
    const correctOption = options.indexOf(item.keyword);

    const templates =
      difficulty === "easy"
        ? [
            `Which term from your notes best matches this statement: "${item.sentence}"?`,
            `Pick the correct concept for this line from your notes: "${item.sentence}".`,
            `Identify the term that fits this notes excerpt: "${item.sentence}".`,
          ]
        : difficulty === "hard"
          ? [
              `In an exam setting, which concept is most strongly supported by this evidence: "${item.sentence}"?`,
              `Which advanced concept is implied by this notes evidence: "${item.sentence}"?`,
              `Choose the best analytical interpretation of this excerpt: "${item.sentence}".`,
            ]
          : [
              `Which term best matches this note statement: "${item.sentence}"?`,
              `Which concept is correctly represented by this excerpt: "${item.sentence}"?`,
              `Select the most accurate term for this notes statement: "${item.sentence}".`,
            ];

    const question = pickTemplate(templates, index, rng);

    return {
      question,
      options,
      correctOption,
      explanation: `(${difficultyLabel}) The source sentence directly references ${item.keyword}.`,
      ...attachMeta(item),
    };
  });

  const shortAnswers = Array.from({ length: 3 }).map((_, index) => {
    const item = expandedItems[(index + 5) % expandedItems.length];
    const question =
      difficulty === "easy"
        ? pickTemplate(
            [
              `Define this concept from your notes in 2-3 lines: ${item.keyword}.`,
              `Give a simple explanation from your notes: ${item.keyword}.`,
              `Write a short definition of ${item.keyword} based on your notes.`,
            ],
            index,
            rng,
          )
        : difficulty === "hard"
          ? pickTemplate(
              [
                `Apply this concept with one practical scenario from your notes: ${item.keyword}.`,
                `Compare ${item.keyword} with a related concept using note evidence.`,
                `Answer this analytically: how would you use ${item.keyword} in an exam scenario?`,
              ],
              index,
              rng,
            )
          : pickTemplate(
              [
                `Explain this concept from your notes: ${item.keyword}.`,
                `Describe ${item.keyword} with one supporting note detail.`,
                `What does your subject material say about ${item.keyword}?`,
              ],
              index,
              rng,
            );

    return {
      question,
      modelAnswer: item.sentence,
      ...attachMeta(item),
    };
  });

  const flashcards = Array.from({ length: 10 }).map((_, index) => {
    const item = expandedItems[index % expandedItems.length];
    const front = pickTemplate(
      [
        `What do your notes say about ${item.keyword}?`,
        `Explain the core idea of ${item.keyword}.`,
        `State a key point for ${item.keyword} from your notes.`,
      ],
      index,
      rng,
    );
    return {
      front,
      back: item.sentence,
      ...attachMeta(item),
    };
  });

  return { difficulty: difficultyLabel, mcqs, shortAnswers, flashcards };
}

function parseJsonBlock<T>(value: string): T | null {
  const blockMatch = value.match(/\{[\s\S]*\}/);
  if (!blockMatch) return null;
  try {
    return JSON.parse(blockMatch[0]) as T;
  } catch {
    return null;
  }
}

async function llmStudy(sourceItems: SourceItem[], difficulty: StudyDifficultyInput, variationKey: string) {
  const difficultyLabel = DIFFICULTY_LABEL[difficulty];
  const rng = seededRandom(hashSeed(`${difficulty}:llm:${variationKey}`));
  const context = shuffleWithRng(sourceItems, rng)
    .map((item, index) => `${index + 1}. ${item.sentence}`)
    .join("\n");

  const raw = await completeWithLLM({
    systemPrompt:
      "Generate study content only from provided facts. Return JSON with keys mcqs, shortAnswers, and flashcards. Every item must include sourceIndex (1-based).",
    userPrompt:
      `Variation token: ${variationKey}
Difficulty: ${difficultyLabel} (${difficultyPromptPrefix(difficulty)}).

Create exactly:
- 5 MCQs (4 options each, correctOption index 0-3, brief explanation)
- 3 short-answer questions with modelAnswer
- 10 flashcards with front and back

Use only these notes:
${context}`,
    temperature: 0.3,
  });

  if (!raw) return null;

  const parsed = parseJsonBlock<{
    mcqs?: Array<{ question: string; options: string[]; correctOption: number; explanation: string; sourceIndex: number }>;
    shortAnswers?: Array<{ question: string; modelAnswer: string; sourceIndex: number }>;
    flashcards?: Array<{ front: string; back: string; sourceIndex: number }>;
  }>(raw);

  if (!parsed?.mcqs || !parsed.shortAnswers || !parsed.flashcards) return null;

  const hasValidMcqShape = parsed.mcqs.slice(0, 5).every((item) => {
    return (
      typeof item.question === "string" &&
      item.question.trim().length > 0 &&
      Array.isArray(item.options) &&
      item.options.length >= 4 &&
      item.options.slice(0, 4).every((option) => typeof option === "string" && option.trim().length > 0) &&
      typeof item.explanation === "string" &&
      item.explanation.trim().length > 0
    );
  });

  const hasValidShortShape = parsed.shortAnswers.slice(0, 3).every((item) => {
    return (
      typeof item.question === "string" &&
      item.question.trim().length > 0 &&
      typeof item.modelAnswer === "string" &&
      item.modelAnswer.trim().length > 0
    );
  });

  const hasValidFlashcardShape = parsed.flashcards.slice(0, 10).every((item) => {
    return (
      typeof item.front === "string" &&
      item.front.trim().length > 0 &&
      typeof item.back === "string" &&
      item.back.trim().length > 0
    );
  });

  if (!hasValidMcqShape || !hasValidShortShape || !hasValidFlashcardShape) {
    return null;
  }

  const mcqs = parsed.mcqs.slice(0, 5).map((item, idx) => {
    const source = sourceItems[Math.max(0, Math.min(sourceItems.length - 1, (item.sourceIndex ?? idx + 1) - 1))];
    return {
      question: item.question,
      options: item.options.slice(0, 4),
      correctOption: Math.max(0, Math.min(3, item.correctOption ?? 0)),
      explanation: item.explanation,
      ...attachMeta(source),
    };
  });

  const shortAnswers = parsed.shortAnswers.slice(0, 3).map((item, idx) => {
    const source = sourceItems[Math.max(0, Math.min(sourceItems.length - 1, (item.sourceIndex ?? idx + 1) - 1))];
    return {
      question: item.question,
      modelAnswer: item.modelAnswer,
      ...attachMeta(source),
    };
  });

  const flashcards = parsed.flashcards.slice(0, 10).map((item, idx) => {
    const source = sourceItems[Math.max(0, Math.min(sourceItems.length - 1, (item.sourceIndex ?? idx + 1) - 1))];
    return {
      front: truncate(item.front, 200),
      back: truncate(item.back, 260),
      ...attachMeta(source),
    };
  });

  if (mcqs.length !== 5 || shortAnswers.length !== 3 || flashcards.length !== 10) {
    return null;
  }

  return {
    difficulty: difficultyLabel,
    mcqs,
    shortAnswers,
    flashcards,
  } satisfies StudyResponsePayload;
}

export async function generateStudyPack(
  chunks: RetrievedChunk[],
  difficulty: StudyDifficultyInput = "medium",
  variationKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
) {
  const sourceItems = getSourceItems(chunks, 12);
  if (sourceItems.length === 0) {
    return null;
  }

  if (isDemoMode()) {
    return deterministicStudy(sourceItems, difficulty, variationKey);
  }

  return (await llmStudy(sourceItems, difficulty, variationKey)) ?? deterministicStudy(sourceItems, difficulty, variationKey);
}
