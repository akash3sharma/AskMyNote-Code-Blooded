import { createEmbeddings } from "@/lib/embeddings";
import { chunkSections } from "@/lib/chunking";
import { parseUploadedContent } from "@/lib/parser";
import { ChunkModel } from "@/models/Chunk";
import { NoteFileModel } from "@/models/NoteFile";
import type { ParsedSection } from "@/lib/types";

async function chunkedEmbeddings(texts: string[], batchSize = 24) {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddingBatch = await createEmbeddings(batch);
    vectors.push(...embeddingBatch);
  }

  return vectors;
}

export async function ingestFile(params: {
  userId: string;
  subjectId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  extension: string;
  buffer: Buffer;
}) {
  const sections = await parseUploadedContent({
    buffer: params.buffer,
    mimeType: params.mimeType,
    extension: params.extension,
  });

  return ingestSections({
    userId: params.userId,
    subjectId: params.subjectId,
    fileId: params.fileId,
    fileName: params.fileName,
    sections,
  });
}

export async function ingestSections(params: {
  userId: string;
  subjectId: string;
  fileId: string;
  fileName: string;
  sections: ParsedSection[];
}) {
  const sections = params.sections;

  const chunks = chunkSections(sections, {
    maxChars: 700,
    overlapChars: 120,
    minChars: 60,
  });

  if (chunks.length === 0) {
    throw new Error("No text content found in this file.");
  }

  const embeddings = await chunkedEmbeddings(chunks.map((chunk) => chunk.text));

  const chunkDocs = chunks.map((chunk, index) => ({
    userId: params.userId,
    subjectId: params.subjectId,
    fileId: params.fileId,
    fileName: params.fileName,
    pageOrSection: chunk.pageOrSection,
    chunkId: `${params.fileId}-${index + 1}`,
    text: chunk.text,
    embedding: embeddings[index],
  }));

  await ChunkModel.insertMany(chunkDocs);

  await NoteFileModel.findByIdAndUpdate(params.fileId, {
    parseStatus: "parsed",
    sectionsCount: sections.length,
    chunksCount: chunkDocs.length,
    errorMessage: "",
  });

  return {
    sectionsCount: sections.length,
    chunksCount: chunkDocs.length,
  };
}

export async function failFileIngestion(fileId: string, message: string) {
  await NoteFileModel.findByIdAndUpdate(fileId, {
    parseStatus: "error",
    errorMessage: message,
  });
}
