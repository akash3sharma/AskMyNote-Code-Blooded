import { cleanText } from "@/lib/utils";
import type { ParsedSection } from "@/lib/types";

export type ChunkingOptions = {
  maxChars?: number;
  overlapChars?: number;
  minChars?: number;
};

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChars: 700,
  overlapChars: 120,
  minChars: 80,
};

export function chunkText(text: string, options: ChunkingOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const normalized = cleanText(text);

  if (!normalized) return [];
  if (normalized.length <= config.maxChars) return [normalized];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    let end = Math.min(cursor + config.maxChars, normalized.length);

    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(" ", end);
      if (boundary > cursor + Math.floor(config.maxChars * 0.6)) {
        end = boundary;
      }
    }

    const piece = cleanText(normalized.slice(cursor, end));
    if (piece.length >= config.minChars || chunks.length === 0) {
      chunks.push(piece);
    }

    if (end >= normalized.length) break;

    cursor = Math.max(end - config.overlapChars, cursor + 1);
  }

  return chunks;
}

export function chunkSections(
  sections: ParsedSection[],
  options: ChunkingOptions = {},
): Array<{ pageOrSection: string; text: string }> {
  const output: Array<{ pageOrSection: string; text: string }> = [];

  for (const section of sections) {
    const chunks = chunkText(section.text, options);
    for (const text of chunks) {
      output.push({
        pageOrSection: section.pageOrSection,
        text,
      });
    }
  }

  return output;
}
