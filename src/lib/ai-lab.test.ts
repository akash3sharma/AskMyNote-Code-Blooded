import { describe, expect, it } from "vitest";

import { generateAiLabPack } from "@/lib/ai-lab";
import type { RetrievedChunk } from "@/lib/types";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    fileName: "notes.txt",
    pageOrSection: "Section 1",
    text: "Learning is the process of gaining knowledge through study and experience. Unlearning removes outdated assumptions.",
    embedding: [0.1, 0.2],
    subjectId: "subject-1",
    fileId: "file-1",
    score: 0.8,
    ...overrides,
  };
}

describe("generateAiLabPack", () => {
  it("returns deterministic concept/flashcard/revision assets with citations", async () => {
    const pack = await generateAiLabPack([
      chunk(),
      chunk({
        chunkId: "chunk-2",
        pageOrSection: "Section 2",
        text: "Recursion solves problems by reducing them into smaller subproblems until base conditions are met.",
      }),
    ]);

    expect(pack).not.toBeNull();
    expect(pack?.keyConcepts).toHaveLength(6);
    expect(pack?.flashcards).toHaveLength(8);
    expect(pack?.revisionPlan).toHaveLength(3);
    expect(pack?.keyConcepts.every((item) => item.citations.length > 0 && item.evidence.length > 0)).toBe(true);
    expect(pack?.flashcards.every((item) => item.citations.length > 0 && item.evidence.length > 0)).toBe(true);
    expect(pack?.revisionPlan.every((item) => item.citations.length > 0 && item.evidence.length > 0)).toBe(true);
  });
});
