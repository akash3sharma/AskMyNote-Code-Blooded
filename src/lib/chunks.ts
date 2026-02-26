import type { ChunkRecord } from "@/lib/types";

type IdLike = string | { toString: () => string } | null | undefined;

type LeanChunkDoc = {
  _id?: IdLike;
  chunkId: string;
  fileName: string;
  pageOrSection: string;
  text: string;
  embedding: number[];
  subjectId: IdLike;
  fileId?: IdLike;
};

function stringifyId(value: IdLike) {
  if (typeof value === "string") return value;
  if (value && typeof value.toString === "function") {
    const output = value.toString();
    if (output && output !== "[object Object]") return output;
  }
  return null;
}

export function resolveChunkFileId(chunk: Pick<LeanChunkDoc, "fileId" | "_id" | "chunkId">) {
  return stringifyId(chunk.fileId) ?? stringifyId(chunk._id) ?? `legacy-${chunk.chunkId}`;
}

export function mapChunkDocToRecord(chunk: LeanChunkDoc): ChunkRecord {
  return {
    chunkId: chunk.chunkId,
    fileName: chunk.fileName,
    pageOrSection: chunk.pageOrSection,
    text: chunk.text,
    embedding: Array.isArray(chunk.embedding) ? chunk.embedding : [],
    subjectId: stringifyId(chunk.subjectId) ?? "",
    fileId: resolveChunkFileId(chunk),
  };
}

export function mapChunkDocsToRecords(chunks: LeanChunkDoc[]) {
  return chunks
    .map((chunk) => mapChunkDocToRecord(chunk))
    .filter((chunk) => chunk.subjectId.length > 0);
}

