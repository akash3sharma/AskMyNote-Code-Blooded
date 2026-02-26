import { describe, expect, it } from "vitest";

import { buildChatResponse } from "@/lib/chat";
import { evaluateRetrievalGating, filterChunksBySubject } from "@/lib/retrieval";
import type { RetrievedChunk } from "@/lib/types";

function chunk(overrides: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    fileName: "lecture.pdf",
    pageOrSection: "Page 1",
    text: "Cell respiration includes glycolysis and ATP production.",
    embedding: [0.1, 0.2],
    subjectId: "subject-a",
    fileId: "file-1",
    score: 0.7,
    ...overrides,
  };
}

describe("filterChunksBySubject", () => {
  it("returns only chunks from the requested subjectId", () => {
    const chunks = [chunk({ subjectId: "math" }), chunk({ subjectId: "biology" }), chunk({ subjectId: "math" })];

    const filtered = filterChunksBySubject(chunks, "math");

    expect(filtered).toHaveLength(2);
    expect(filtered.every((item) => item.subjectId === "math")).toBe(true);
  });
});

describe("Not Found gating", () => {
  it("passes with one strong chunk when subject has limited notes", () => {
    const result = evaluateRetrievalGating({
      query: "What is glycolysis?",
      scoredChunks: [
        chunk({
          score: 0.82,
          text: "Glycolysis is a metabolic pathway that converts glucose to pyruvate in the cytoplasm.",
        }),
      ],
      threshold: 0.2,
      minChunks: 2,
    });

    expect(result.passed).toBe(true);
  });

  it("fails when best similarity is below threshold", () => {
    const result = evaluateRetrievalGating({
      query: "What is glycolysis?",
      scoredChunks: [chunk({ score: 0.1 }), chunk({ score: 0.09 })],
      threshold: 0.2,
      minChunks: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toBe("low_score");
  });

  it("fails when there is no direct evidence snippet", () => {
    const result = evaluateRetrievalGating({
      query: "What is glycolysis?",
      scoredChunks: [
        chunk({ score: 0.8, text: "The chapter discusses photosynthesis in leaves." }),
        chunk({ score: 0.75, text: "Light reactions happen in chloroplast membranes." }),
      ],
      threshold: 0.2,
      minChunks: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toBe("no_direct_evidence");
  });

  it("returns exact Not Found string from chat response when gating fails", async () => {
    const response = await buildChatResponse({
      question: "Explain glycolysis",
      subjectName: "Biology",
      retrievedChunks: [chunk({ score: 0.05 })],
    });

    expect(response.answer).toBe("Not found in your notes for Biology");
    expect(response.citations).toHaveLength(0);
    expect(response.evidence).toHaveLength(0);
  });

  it("allows chat response when one strongly relevant chunk exists", async () => {
    const response = await buildChatResponse({
      question: "What is glycolysis?",
      subjectName: "Biology",
      retrievedChunks: [
        chunk({
          score: 0.8,
          text: "Glycolysis is the first stage of cellular respiration and occurs in the cytoplasm.",
        }),
      ],
    });

    expect(response.answer).not.toBe("Not found in your notes for Biology");
    expect(response.citations.length).toBeGreaterThan(0);
    expect(response.evidence.length).toBeGreaterThan(0);
  });
});
