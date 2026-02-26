import { describe, expect, it } from "vitest";

import { buildExplainPayload, buildPlannerPayload, buildSearchPayload } from "@/lib/boost";
import type { RetrievedChunk } from "@/lib/types";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    fileName: "notes.txt",
    pageOrSection: "Section 1",
    text: "Recursion solves a problem by reducing it into smaller subproblems until a base case is reached.",
    embedding: [0.1, 0.2],
    subjectId: "subject-1",
    fileId: "file-1",
    score: 0.82,
    ...overrides,
  };
}

describe("boost search", () => {
  it("returns ranked hits with snippets", () => {
    const response = buildSearchPayload({
      query: "what is recursion",
      retrievedChunks: [chunk(), chunk({ chunkId: "chunk-2", score: 0.6 })],
      limit: 5,
    });

    expect(response.totalHits).toBe(2);
    expect(response.hits[0].chunkId).toBe("chunk-1");
    expect(response.hits[0].textSnippet.length).toBeGreaterThan(20);
  });
});

describe("boost explain", () => {
  it("returns strict not-found when evidence is weak", async () => {
    const response = await buildExplainPayload({
      concept: "recursion",
      subjectName: "DSA",
      retrievedChunks: [
        chunk({
          score: 0.03,
          text: "Photosynthesis takes place in chloroplasts under sunlight.",
        }),
      ],
    });

    expect(response.oneLiner).toBe("Not found in your notes for DSA");
    expect(response.citations).toHaveLength(0);
  });
});

describe("boost planner", () => {
  it("generates a practical plan from retrieved chunks", async () => {
    const response = await buildPlannerPayload({
      goalMinutes: 45,
      focus: "recursion",
      retrievedChunks: [
        chunk(),
        chunk({
          chunkId: "chunk-2",
          pageOrSection: "Section 2",
          text: "Stacks are LIFO structures with push and pop operations.",
          score: 0.71,
        }),
      ],
    });

    expect(response).not.toBeNull();
    expect((response?.plan.length ?? 0) >= 3).toBe(true);
    expect(response?.totalMinutes).toBeGreaterThan(0);
    expect(response?.plan[0].citations.length).toBeGreaterThan(0);
  });
});
