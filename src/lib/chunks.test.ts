import { describe, expect, it } from "vitest";

import { mapChunkDocToRecord, resolveChunkFileId } from "@/lib/chunks";

describe("chunk mapping helpers", () => {
  it("falls back to _id when fileId is missing", () => {
    const record = mapChunkDocToRecord({
      _id: "doc_1",
      chunkId: "chunk_1",
      fileName: "notes.txt",
      pageOrSection: "Section 1",
      text: "Some content",
      embedding: [0.1, 0.2],
      subjectId: "subject_1",
      fileId: undefined,
    });

    expect(record.fileId).toBe("doc_1");
  });

  it("uses deterministic legacy id when both fileId and _id are missing", () => {
    const fileId = resolveChunkFileId({
      chunkId: "chunk_legacy_42",
      fileId: undefined,
      _id: undefined,
    });

    expect(fileId).toBe("legacy-chunk_legacy_42");
  });
});

