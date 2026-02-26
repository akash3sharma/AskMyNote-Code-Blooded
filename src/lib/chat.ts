import { isDemoMode } from "@/lib/env";
import { completeWithLLM } from "@/lib/llm";
import { confidenceFromScores, evaluateRetrievalGating, queryTerms } from "@/lib/retrieval";
import { sentenceSplit, truncate } from "@/lib/utils";
import type { ChatResponsePayload, ChatTurn, RetrievedChunk } from "@/lib/types";

const FOLLOW_UP_PATTERNS: RegExp[] = [
  /^give (an|a) example/i,
  /^can you give (an|a) example/i,
  /^simplify( it| this)?/i,
  /^explain( it| this)? in simple terms/i,
  /^compare( it| this)/i,
  /^what about/i,
  /^and what/i,
  /^why\??$/i,
  /^how\??$/i,
  /^elaborate/i,
  /^continue/i,
  /^tell me more/i,
  /^what does that mean/i,
  /^same for/i,
  /^now compare/i,
  /^with the previous/i,
];

function notFoundPayload(subjectName: string): ChatResponsePayload {
  return {
    answer: `Not found in your notes for ${subjectName}`,
    confidence: "Low",
    citations: [],
    evidence: [],
  };
}

function isSummaryStyleQuestion(question: string) {
  return /what is (this|it) about|summary|summarize|overview|main topic|what are these notes about|explain this/i.test(
    question.toLowerCase(),
  );
}

function isLikelyFollowUpQuestion(question: string) {
  const trimmed = question.trim();
  if (!trimmed) return false;

  if (FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length <= 6 && tokens.some((token) => ["it", "that", "this", "previous", "same"].includes(token))) {
    return true;
  }

  return false;
}

function compactHistory(history: ChatTurn[], maxTurns = 8) {
  return history
    .filter((turn) => turn.text.trim().length > 0)
    .slice(-maxTurns)
    .map((turn) => ({ role: turn.role, text: truncate(turn.text.trim(), 280) }));
}

function historyPrompt(history: ChatTurn[]) {
  if (history.length === 0) return "None";

  return history
    .map((turn, index) => `${index + 1}. ${turn.role === "user" ? "User" : "Assistant"}: ${turn.text}`)
    .join("\n");
}

function heuristicEffectiveQuestion(question: string, history: ChatTurn[]) {
  const compact = compactHistory(history, 6);
  const lastUser = [...compact].reverse().find((turn) => turn.role === "user")?.text ?? "";
  const lastAssistant = [...compact].reverse().find((turn) => turn.role === "assistant")?.text ?? "";

  const context = [lastUser, lastAssistant].filter(Boolean).join(" ");
  if (!context) return question;

  return truncate(`${question}. Previous context: ${context}`, 900);
}

async function llmRewriteFollowUp(question: string, history: ChatTurn[]) {
  const compact = compactHistory(history, 8);
  if (compact.length === 0) return null;

  const rewrite = await completeWithLLM({
    systemPrompt:
      "Rewrite follow-up questions into standalone retrieval queries grounded in recent conversation. Return only the rewritten question.",
    userPrompt: `Recent conversation:\n${historyPrompt(compact)}\n\nCurrent question: ${question}`,
    temperature: 0,
  });

  if (!rewrite) return null;

  const cleaned = rewrite.replace(/^standalone question\s*:\s*/i, "").trim();
  if (!cleaned) return null;

  return truncate(cleaned, 900);
}

export async function resolveEffectiveQuestion(params: { question: string; history?: ChatTurn[] }) {
  const question = params.question.trim();
  const history = compactHistory(params.history ?? [], 8);

  if (!history.length) {
    return question;
  }

  if (!isLikelyFollowUpQuestion(question)) {
    return question;
  }

  if (!isDemoMode()) {
    const rewritten = await llmRewriteFollowUp(question, history);
    if (rewritten) {
      return rewritten;
    }
  }

  return heuristicEffectiveQuestion(question, history);
}

function buildCitations(chunks: RetrievedChunk[]) {
  return chunks.map((chunk) => ({
    fileName: chunk.fileName,
    pageOrSection: chunk.pageOrSection,
    chunkId: chunk.chunkId,
  }));
}

function buildEvidence(chunks: RetrievedChunk[]) {
  return chunks.map((chunk) => ({
    fileName: chunk.fileName,
    pageOrSection: chunk.pageOrSection,
    textSnippet: truncate(chunk.text, 200),
  }));
}

function extractiveAnswer(question: string, chunks: RetrievedChunk[]) {
  const terms = queryTerms(question);
  const rankedSentences = chunks.flatMap((chunk) =>
    sentenceSplit(chunk.text).map((sentence) => {
      const sentenceLower = sentence.toLowerCase();
      const overlap = terms.reduce((count, term) => (sentenceLower.includes(term) ? count + 1 : count), 0);
      return { sentence, overlap, score: chunk.score };
    }),
  );

  const filtered = rankedSentences
    .sort((a, b) => b.overlap - a.overlap || b.score - a.score)
    .filter((item) => item.overlap > 0)
    .slice(0, 3);

  if (filtered.length === 0) {
    return truncate(chunks[0]?.text ?? "", 240);
  }

  return filtered.map((item) => item.sentence).join(" ");
}

async function llmAnswer(params: {
  question: string;
  effectiveQuestion: string;
  history: ChatTurn[];
  chunks: RetrievedChunk[];
}) {
  const context = params.chunks
    .map((chunk, index) => {
      return `Context ${index + 1} [${chunk.chunkId}] (${chunk.fileName} ${chunk.pageOrSection}): ${chunk.text}`;
    })
    .join("\n\n");

  const response = await completeWithLLM({
    systemPrompt:
      "You are a clear, teacher-like tutor. Answer only from provided note context. If context is insufficient, reply with INSUFFICIENT. Keep answers concise.",
    userPrompt: `Current user question: ${params.question}\nResolved retrieval question: ${params.effectiveQuestion}\nRecent conversation:\n${historyPrompt(
      compactHistory(params.history, 6),
    )}\n\nContexts:\n${context}`,
    temperature: 0.1,
  });

  if (!response || /INSUFFICIENT/i.test(response)) {
    return null;
  }

  return response;
}

export async function buildChatResponse(params: {
  question: string;
  effectiveQuestion?: string;
  history?: ChatTurn[];
  subjectName: string;
  retrievedChunks: RetrievedChunk[];
}) {
  const effectiveQuestion = params.effectiveQuestion?.trim() || params.question.trim();
  const history = params.history ?? [];

  if (isSummaryStyleQuestion(params.question)) {
    const support = params.retrievedChunks.filter((chunk) => chunk.text.trim().length > 0).slice(0, 4);

    if (support.length === 0) {
      return notFoundPayload(params.subjectName);
    }

    const answer = isDemoMode()
      ? extractiveAnswer(effectiveQuestion, support)
      : (await llmAnswer({
          question: params.question,
          effectiveQuestion,
          history,
          chunks: support,
        })) ?? extractiveAnswer(effectiveQuestion, support);

    return {
      answer,
      confidence: confidenceFromScores(support[0]?.score ?? 0, support.length),
      citations: buildCitations(support),
      evidence: buildEvidence(support),
    } satisfies ChatResponsePayload;
  }

  const gating = evaluateRetrievalGating({
    query: effectiveQuestion,
    scoredChunks: params.retrievedChunks,
  });

  if (!gating.passed) {
    return notFoundPayload(params.subjectName);
  }

  const support = gating.directEvidence.slice(0, 4);

  let answer = "";

  if (isDemoMode()) {
    answer = extractiveAnswer(effectiveQuestion, support);
  } else {
    answer =
      (await llmAnswer({
        question: params.question,
        effectiveQuestion,
        history,
        chunks: support,
      })) ?? extractiveAnswer(effectiveQuestion, support);
  }

  if (!answer) {
    return notFoundPayload(params.subjectName);
  }

  return {
    answer,
    confidence: gating.confidence,
    citations: buildCitations(support),
    evidence: buildEvidence(support),
  } satisfies ChatResponsePayload;
}
