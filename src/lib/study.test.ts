import { describe, expect, it } from "vitest";

import { generateStudyPack } from "@/lib/study";
import type { RetrievedChunk } from "@/lib/types";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    fileName: "notes.txt",
    pageOrSection: "Section 1",
    text: "Recursion solves complex problems by dividing them into smaller subproblems until a base case is reached.",
    embedding: [0.1, 0.2],
    subjectId: "subject-1",
    fileId: "file-1",
    score: 0.8,
    ...overrides,
  };
}

describe("generateStudyPack", () => {
  it("includes difficulty and flashcards", async () => {
    const study = await generateStudyPack(
      [
        chunk(),
        chunk({
          chunkId: "chunk-2",
          pageOrSection: "Section 2",
          text: "Stacks follow last-in-first-out order and support push and pop operations.",
        }),
      ],
      "hard",
    );

    expect(study).not.toBeNull();
    expect(study?.difficulty).toBe("Hard");
    expect(study?.mcqs).toHaveLength(5);
    expect(study?.shortAnswers).toHaveLength(3);
    expect(study?.flashcards).toHaveLength(10);
    expect(study?.flashcards[0].front.length).toBeGreaterThan(5);
  });

  it("changes question set when variation key changes", async () => {
    const chunks = [
      chunk(),
      chunk({
        chunkId: "chunk-2",
        pageOrSection: "Section 2",
        text: "Binary search halves the search space each iteration in sorted arrays.",
      }),
      chunk({
        chunkId: "chunk-3",
        pageOrSection: "Section 3",
        text: "Dynamic programming stores overlapping subproblem results for optimization.",
      }),
    ];

    const first = await generateStudyPack(chunks, "medium", "variant-a");
    const second = await generateStudyPack(chunks, "medium", "variant-b");

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const questionChanged = first?.mcqs[0]?.question !== second?.mcqs[0]?.question;
    const flashcardChanged = first?.flashcards[0]?.front !== second?.flashcards[0]?.front;
    expect(questionChanged || flashcardChanged).toBe(true);
  });
});
