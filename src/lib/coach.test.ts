import { describe, expect, it } from "vitest";

import { evaluateCoachResponse } from "@/lib/coach";
import type { RetrievedChunk } from "@/lib/types";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    fileName: "bio.pdf",
    pageOrSection: "Page 1",
    text: "Glycolysis is the first stage of cellular respiration and occurs in the cytoplasm to generate ATP.",
    embedding: [0.1, 0.2],
    subjectId: "subject-1",
    fileId: "file-1",
    score: 0.85,
    ...overrides,
  };
}

describe("evaluateCoachResponse", () => {
  it("returns scored coaching feedback when evidence is available", async () => {
    const result = await evaluateCoachResponse({
      question: "What is glycolysis?",
      userAnswer: "Glycolysis is an early respiration step that makes ATP in cytoplasm.",
      subjectName: "Biology",
      retrievedChunks: [chunk()],
    });

    expect(result.score).toBeGreaterThan(0);
    expect(["Excellent", "Good", "Needs Work"]).toContain(result.verdict);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.improvedAnswer.length).toBeGreaterThan(10);
  });

  it("returns strict not-found feedback when retrieval support is weak", async () => {
    const result = await evaluateCoachResponse({
      question: "What is glycolysis?",
      userAnswer: "I do not know.",
      subjectName: "Biology",
      retrievedChunks: [
        chunk({
          score: 0.05,
          text: "Ancient history focuses on Mesopotamia and early civilizations.",
        }),
      ],
    });

    expect(result.feedback).toBe("Not found in your notes for Biology");
    expect(result.improvedAnswer).toBe("Not found in your notes for Biology");
    expect(result.citations).toHaveLength(0);
    expect(result.evidence).toHaveLength(0);
  });
});
