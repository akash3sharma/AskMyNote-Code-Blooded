import { isDemoMode } from "@/lib/env";
import { completeWithLLM } from "@/lib/llm";
import { evaluateRetrievalGating } from "@/lib/retrieval";
import { tokenize, truncate } from "@/lib/utils";
import type { CoachResponsePayload, RetrievedChunk } from "@/lib/types";

function jaccardSimilarity(a: string, b: string) {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));
  if (aSet.size === 0 || bSet.size === 0) return 0;

  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap += 1;
  }

  const union = new Set([...aSet, ...bSet]).size || 1;
  return overlap / union;
}

function extractiveImprovedAnswer(chunks: RetrievedChunk[]) {
  return truncate(
    chunks
      .map((chunk) => chunk.text)
      .join(" ")
      .split(/(?<=[.!?])\s+/)
      .slice(0, 3)
      .join(" "),
    420,
  );
}

async function llmImprovedAnswer(question: string, userAnswer: string, chunks: RetrievedChunk[]) {
  const context = chunks
    .map((chunk, index) => `${index + 1}. ${chunk.text}`)
    .join("\n");

  const response = await completeWithLLM({
    systemPrompt:
      "You are a strict tutor. Improve the student's answer using only note evidence. Keep it concise. If context is insufficient, return INSUFFICIENT.",
    userPrompt: `Question: ${question}
Student answer: ${userAnswer}

Evidence:
${context}`,
    temperature: 0.2,
  });

  if (!response || /INSUFFICIENT/i.test(response)) {
    return null;
  }

  return truncate(response, 420);
}

function missingTermsFromEvidence(answer: string, chunks: RetrievedChunk[]) {
  const answerTerms = new Set(tokenize(answer));
  const evidenceTerms = tokenize(chunks.map((chunk) => chunk.text).join(" "))
    .filter((token) => token.length >= 4)
    .slice(0, 120);

  const counts = new Map<string, number>();
  for (const term of evidenceTerms) {
    if (answerTerms.has(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([term]) => term);
}

function feedbackByScore(score: number, missingPoints: string[]) {
  if (score >= 80) {
    return "Strong answer grounded in your notes. Add one concrete example to make it even better.";
  }
  if (score >= 55) {
    return `Partially correct. Improve by covering missing points: ${missingPoints.slice(0, 3).join(", ") || "key details"}.`;
  }
  return "Answer is weak against your notes. Revisit the evidence and include core definitions and examples.";
}

function toCitations(chunks: RetrievedChunk[]) {
  return chunks.map((chunk) => ({
    fileName: chunk.fileName,
    pageOrSection: chunk.pageOrSection,
    chunkId: chunk.chunkId,
  }));
}

function toEvidence(chunks: RetrievedChunk[]) {
  return chunks.map((chunk) => ({
    fileName: chunk.fileName,
    pageOrSection: chunk.pageOrSection,
    textSnippet: truncate(chunk.text, 200),
  }));
}

export async function evaluateCoachResponse(params: {
  question: string;
  userAnswer: string;
  subjectName: string;
  retrievedChunks: RetrievedChunk[];
}): Promise<CoachResponsePayload> {
  const gating = evaluateRetrievalGating({
    query: params.question,
    scoredChunks: params.retrievedChunks,
  });

  if (!gating.passed) {
    const notFound = `Not found in your notes for ${params.subjectName}`;
    return {
      score: 0,
      verdict: "Needs Work",
      feedback: notFound,
      missingPoints: [],
      improvedAnswer: notFound,
      citations: [],
      evidence: [],
    };
  }

  const support = gating.directEvidence.slice(0, 4);
  const expected = support.map((chunk) => chunk.text).join(" ");
  const similarity = jaccardSimilarity(params.userAnswer, expected);
  const score = Math.max(0, Math.min(100, Math.round(similarity * 70 + gating.bestScore * 30)));
  const verdict: CoachResponsePayload["verdict"] = score >= 80 ? "Excellent" : score >= 55 ? "Good" : "Needs Work";
  const missingPoints = missingTermsFromEvidence(params.userAnswer, support);

  const improvedAnswer = isDemoMode()
    ? extractiveImprovedAnswer(support)
    : (await llmImprovedAnswer(params.question, params.userAnswer, support)) ?? extractiveImprovedAnswer(support);

  return {
    score,
    verdict,
    feedback: feedbackByScore(score, missingPoints),
    missingPoints,
    improvedAnswer,
    citations: toCitations(support),
    evidence: toEvidence(support),
  };
}
