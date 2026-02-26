import { env } from "@/lib/env";
import { cosineSimilarity, embedQuery, localEmbedding } from "@/lib/embeddings";
import { sentenceSplit, tokenize } from "@/lib/utils";
import type { ChunkRecord, Confidence, RetrievedChunk } from "@/lib/types";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "your",
  "this",
  "that",
  "what",
  "when",
  "where",
  "which",
  "about",
  "into",
  "does",
  "have",
  "will",
  "would",
  "there",
  "their",
]);

export function queryTerms(query: string) {
  return tokenize(query).filter((token) => !STOP_WORDS.has(token));
}

export function filterChunksBySubject<T extends { subjectId: string }>(chunks: T[], subjectId: string) {
  return chunks.filter((chunk) => chunk.subjectId === subjectId);
}

function overlapCount(query: string, text: string) {
  const terms = queryTerms(query);
  if (terms.length === 0) return 0;

  const tokenSet = new Set(tokenize(text));
  let count = 0;
  for (const term of terms) {
    if (tokenSet.has(term)) {
      count += 1;
    }
  }

  return count;
}

function lexicalSimilarity(query: string, text: string) {
  const terms = queryTerms(query);
  if (terms.length === 0) return 0;
  return overlapCount(query, text) / terms.length;
}

function hasDirectSnippet(query: string, text: string) {
  const terms = queryTerms(query);
  if (terms.length === 0) return false;

  const sentences = sentenceSplit(text);
  const minMatches = Math.min(2, terms.length);

  return sentences.some((sentence) => overlapCount(query, sentence) >= minMatches);
}

export function confidenceFromScores(bestScore: number, supportingChunks: number): Confidence {
  if (bestScore >= 0.7 && supportingChunks >= 3) return "High";
  if (bestScore >= 0.48 && supportingChunks >= 2) return "Medium";
  return "Low";
}

export function evaluateRetrievalGating(params: {
  query: string;
  scoredChunks: RetrievedChunk[];
  threshold?: number;
  minChunks?: number;
}) {
  const threshold = params.threshold ?? env.RETRIEVAL_THRESHOLD;
  const minChunks = params.minChunks ?? env.RETRIEVAL_MIN_CHUNKS;
  const sorted = [...params.scoredChunks].sort((a, b) => b.score - a.score);
  const bestScore = sorted[0]?.score ?? 0;

  const supportingChunks = sorted.filter((chunk) => chunk.score >= threshold * 0.85);
  const directEvidence = supportingChunks.filter((chunk) => hasDirectSnippet(params.query, chunk.text));
  const availableChunkCount = sorted.length;
  const adaptiveMinChunks = Math.max(1, Math.min(minChunks, availableChunkCount));

  const notEnoughScore = bestScore < threshold;
  let notEnoughChunks = supportingChunks.length < adaptiveMinChunks;
  const lacksDirectSupport = directEvidence.length === 0;

  // For small note sets (e.g., one uploaded chunk), allow a single strong direct hit.
  if (notEnoughChunks && directEvidence.length >= 1 && bestScore >= Math.max(0.5, threshold + 0.1)) {
    notEnoughChunks = false;
  }

  const passed = !(notEnoughScore || notEnoughChunks || lacksDirectSupport);

  return {
    passed,
    bestScore,
    supportingChunks,
    directEvidence,
    reason: passed
      ? "ok"
      : notEnoughScore
        ? "low_score"
        : notEnoughChunks
          ? "too_few_chunks"
          : "no_direct_evidence",
    confidence: confidenceFromScores(bestScore, directEvidence.length),
  };
}

export async function retrieveRelevantChunks(params: {
  query: string;
  subjectId: string;
  chunks: ChunkRecord[];
  topK?: number;
}) {
  const filtered = filterChunksBySubject(params.chunks, params.subjectId);
  if (filtered.length === 0) return [] as RetrievedChunk[];

  let queryEmbedding = await embedQuery(params.query);
  const chunkDim = filtered[0]?.embedding.length ?? 0;

  if (chunkDim > 0 && queryEmbedding.length !== chunkDim) {
    queryEmbedding = localEmbedding(params.query, chunkDim);
  }

  const scored: RetrievedChunk[] = filtered
    .map((chunk) => {
      const canUseCosine =
        queryEmbedding.length > 0 &&
        chunk.embedding.length > 0 &&
        queryEmbedding.length === chunk.embedding.length;

      const lexicalScore = lexicalSimilarity(params.query, chunk.text);
      const cosineScore = canUseCosine ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
      const score = Math.max(cosineScore, lexicalScore);

      return {
        ...chunk,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, params.topK ?? 8);
}
