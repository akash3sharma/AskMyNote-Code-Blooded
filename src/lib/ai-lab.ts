import { isDemoMode } from "@/lib/env";
import { completeWithLLM } from "@/lib/llm";
import { tokenize, truncate } from "@/lib/utils";
import type { AiLabResponsePayload, RetrievedChunk } from "@/lib/types";

type SourceItem = {
  sentence: string;
  keyword: string;
  chunk: RetrievedChunk;
};

function pickKeyword(sentence: string) {
  const tokens = tokenize(sentence).filter((token) => token.length >= 4);
  return tokens.sort((a, b) => b.length - a.length)[0] ?? "concept";
}

function toTitle(value: string) {
  return value
    .split(/\s+/)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function collectSourceItems(chunks: RetrievedChunk[], limit = 16) {
  const items: SourceItem[] = [];

  for (const chunk of chunks) {
    const sentences = chunk.text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 30);

    for (const sentence of sentences) {
      items.push({
        sentence: truncate(sentence, 240),
        keyword: pickKeyword(sentence),
        chunk,
      });
    }
  }

  return items
    .sort((a, b) => b.chunk.score - a.chunk.score || b.sentence.length - a.sentence.length)
    .slice(0, limit);
}

function expandItems(items: SourceItem[], target: number) {
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

function parseJsonBlock<T>(value: string) {
  const block = value.match(/\{[\s\S]*\}/);
  if (!block) return null;

  try {
    return JSON.parse(block[0]) as T;
  } catch {
    return null;
  }
}

function deterministicAiLab(sourceItems: SourceItem[]): AiLabResponsePayload {
  const conceptsBase = expandItems(sourceItems, 6);
  const cardsBase = expandItems(sourceItems, 8);
  const planBase = expandItems(sourceItems, 3);

  const keyConcepts = conceptsBase.map((item) => ({
    title: toTitle(item.keyword),
    summary: item.sentence,
    ...attachMeta(item),
  }));

  const flashcards = cardsBase.map((item) => ({
    front: `What do your notes say about ${item.keyword}?`,
    back: item.sentence,
    ...attachMeta(item),
  }));

  const revisionPlan = planBase.map((item, index) => ({
    day: index + 1,
    focus: toTitle(item.keyword),
    task: `Review the evidence and rewrite it in your own words, then solve one practice question on ${item.keyword}.`,
    ...attachMeta(item),
  }));

  return { keyConcepts, flashcards, revisionPlan };
}

function resolveSource(sourceItems: SourceItem[], sourceIndex: number | undefined, fallbackIndex: number) {
  const resolved = Math.max(0, Math.min(sourceItems.length - 1, (sourceIndex ?? fallbackIndex + 1) - 1));
  return sourceItems[resolved];
}

async function llmAiLab(sourceItems: SourceItem[]) {
  const context = sourceItems
    .map((item, index) => `${index + 1}. ${item.sentence}`)
    .join("\n");

  const raw = await completeWithLLM({
    systemPrompt:
      "Generate premium learning assets from provided notes only. Return JSON with keyConcepts, flashcards, revisionPlan and sourceIndex for every item.",
    userPrompt: `Using only these notes, create exactly:
- 6 key concepts (title + summary + sourceIndex)
- 8 flashcards (front + back + sourceIndex)
- 3 revision plan items (day + focus + task + sourceIndex)

Return strict JSON only.

Notes:
${context}`,
    temperature: 0.3,
  });

  if (!raw) return null;

  const parsed = parseJsonBlock<{
    keyConcepts?: Array<{ title: string; summary: string; sourceIndex: number }>;
    flashcards?: Array<{ front: string; back: string; sourceIndex: number }>;
    revisionPlan?: Array<{ day: number; focus: string; task: string; sourceIndex: number }>;
  }>(raw);

  if (!parsed?.keyConcepts || !parsed.flashcards || !parsed.revisionPlan) {
    return null;
  }

  if (parsed.keyConcepts.length < 6 || parsed.flashcards.length < 8 || parsed.revisionPlan.length < 3) {
    return null;
  }

  const keyConcepts = parsed.keyConcepts.slice(0, 6).map((item, index) => {
    const source = resolveSource(sourceItems, item.sourceIndex, index);
    return {
      title: truncate(item.title?.trim() || toTitle(source.keyword), 90),
      summary: truncate(item.summary?.trim() || source.sentence, 220),
      ...attachMeta(source),
    };
  });

  const flashcards = parsed.flashcards.slice(0, 8).map((item, index) => {
    const source = resolveSource(sourceItems, item.sourceIndex, index);
    return {
      front: truncate(item.front?.trim() || `Explain ${source.keyword}`, 160),
      back: truncate(item.back?.trim() || source.sentence, 220),
      ...attachMeta(source),
    };
  });

  const revisionPlan = parsed.revisionPlan.slice(0, 3).map((item, index) => {
    const source = resolveSource(sourceItems, item.sourceIndex, index);
    return {
      day: index + 1,
      focus: truncate(item.focus?.trim() || toTitle(source.keyword), 90),
      task: truncate(item.task?.trim() || `Revise ${source.keyword} with examples from your notes.`, 220),
      ...attachMeta(source),
    };
  });

  return { keyConcepts, flashcards, revisionPlan } satisfies AiLabResponsePayload;
}

export async function generateAiLabPack(chunks: RetrievedChunk[]) {
  const sourceItems = collectSourceItems(chunks, 18);
  if (sourceItems.length === 0) {
    return null;
  }

  if (isDemoMode()) {
    return deterministicAiLab(sourceItems);
  }

  return (await llmAiLab(sourceItems)) ?? deterministicAiLab(sourceItems);
}
