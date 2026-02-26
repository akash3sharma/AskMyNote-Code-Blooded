import { isDemoMode } from "@/lib/env";
import { completeWithLLM } from "@/lib/llm";
import { confidenceFromScores, evaluateRetrievalGating, queryTerms } from "@/lib/retrieval";
import { sentenceSplit, tokenize, truncate } from "@/lib/utils";
import type {
  BoostExplainResponsePayload,
  BoostPlannerResponsePayload,
  BoostSearchResponsePayload,
  RetrievedChunk,
} from "@/lib/types";

type PlannerSource = {
  sentence: string;
  keyword: string;
  chunk: RetrievedChunk;
};

function parseJsonBlock<T>(value: string) {
  const block = value.match(/\{[\s\S]*\}/);
  if (!block) return null;
  try {
    return JSON.parse(block[0]) as T;
  } catch {
    return null;
  }
}

function attachCitations(chunks: RetrievedChunk[]) {
  return chunks.map((chunk) => ({
    fileName: chunk.fileName,
    pageOrSection: chunk.pageOrSection,
    chunkId: chunk.chunkId,
  }));
}

function attachEvidence(chunks: RetrievedChunk[]) {
  return chunks.map((chunk) => ({
    fileName: chunk.fileName,
    pageOrSection: chunk.pageOrSection,
    textSnippet: truncate(chunk.text, 200),
  }));
}

export function buildSearchPayload(params: {
  query: string;
  retrievedChunks: RetrievedChunk[];
  limit?: number;
}): BoostSearchResponsePayload {
  const limit = Math.max(1, Math.min(20, params.limit ?? 8));
  const hits = params.retrievedChunks
    .filter((chunk) => chunk.score > 0)
    .slice(0, limit)
    .map((chunk) => ({
      fileName: chunk.fileName,
      pageOrSection: chunk.pageOrSection,
      chunkId: chunk.chunkId,
      score: Math.round(chunk.score * 1000) / 1000,
      textSnippet: truncate(chunk.text, 260),
    }));

  return {
    query: params.query,
    totalHits: hits.length,
    hits,
  };
}

function extractiveExplain(chunks: RetrievedChunk[]) {
  const sentences = chunks.flatMap((chunk) => sentenceSplit(chunk.text)).filter(Boolean);

  const oneLiner = truncate(sentences[0] || chunks[0]?.text || "", 140);
  const simple = truncate(sentences.slice(0, 2).join(" "), 280);
  const examReady = truncate(sentences.slice(0, 4).join(" "), 460);

  return { oneLiner, simple, examReady };
}

async function llmExplain(concept: string, chunks: RetrievedChunk[]) {
  const context = chunks
    .map((chunk, index) => `${index + 1}. ${chunk.text}`)
    .join("\n");

  const raw = await completeWithLLM({
    systemPrompt:
      "Explain concept strictly from note evidence. Return JSON with keys oneLiner, simple, examReady. Keep concise and accurate.",
    userPrompt: `Concept: ${concept}\n\nEvidence:\n${context}`,
    temperature: 0.2,
  });

  if (!raw) return null;
  const parsed = parseJsonBlock<{ oneLiner?: string; simple?: string; examReady?: string }>(raw);
  if (!parsed?.oneLiner || !parsed.simple || !parsed.examReady) return null;

  return {
    oneLiner: truncate(parsed.oneLiner, 160),
    simple: truncate(parsed.simple, 300),
    examReady: truncate(parsed.examReady, 520),
  };
}

export async function buildExplainPayload(params: {
  concept: string;
  subjectName: string;
  retrievedChunks: RetrievedChunk[];
}): Promise<BoostExplainResponsePayload> {
  const gating = evaluateRetrievalGating({
    query: params.concept,
    scoredChunks: params.retrievedChunks,
  });

  if (!gating.passed) {
    const notFound = `Not found in your notes for ${params.subjectName}`;
    return {
      concept: params.concept,
      oneLiner: notFound,
      simple: notFound,
      examReady: notFound,
      confidence: "Low",
      citations: [],
      evidence: [],
    };
  }

  const support = gating.directEvidence.slice(0, 4);
  const deterministic = extractiveExplain(support);

  const finalExplain =
    isDemoMode() || support.length === 0 ? deterministic : (await llmExplain(params.concept, support)) ?? deterministic;

  return {
    concept: params.concept,
    oneLiner: finalExplain.oneLiner,
    simple: finalExplain.simple,
    examReady: finalExplain.examReady,
    confidence: confidenceFromScores(support[0]?.score ?? 0, support.length),
    citations: attachCitations(support),
    evidence: attachEvidence(support),
  };
}

function pickKeyword(sentence: string) {
  const terms = tokenize(sentence).filter((term) => term.length >= 4);
  return terms.sort((a, b) => b.length - a.length)[0] ?? "concept";
}

function buildPlannerSources(chunks: RetrievedChunk[], limit = 10) {
  const output: PlannerSource[] = [];

  for (const chunk of chunks) {
    const sentences = sentenceSplit(chunk.text).filter((sentence) => sentence.length >= 24);
    for (const sentence of sentences) {
      output.push({
        sentence: truncate(sentence, 230),
        keyword: pickKeyword(sentence),
        chunk,
      });
    }
  }

  return output
    .sort((a, b) => b.chunk.score - a.chunk.score || b.sentence.length - a.sentence.length)
    .slice(0, limit);
}

function expandSources(sources: PlannerSource[], target: number) {
  if (sources.length === 0) return [];
  if (sources.length >= target) return sources.slice(0, target);

  const expanded = [...sources];
  let index = 0;
  while (expanded.length < target) {
    expanded.push(sources[index % sources.length]);
    index += 1;
  }
  return expanded;
}

function deterministicPlanner(params: { goalMinutes: number; focus?: string; sources: PlannerSource[] }): BoostPlannerResponsePayload {
  const blocks = Math.max(3, Math.min(8, Math.round(params.goalMinutes / 15)));
  const expanded = expandSources(params.sources, blocks);
  const baseDuration = Math.max(8, Math.floor(params.goalMinutes / blocks));

  const plan = expanded.map((source, index) => ({
    title: `Block ${index + 1}: ${source.keyword}`,
    durationMinutes: baseDuration,
    task:
      index % 3 === 0
        ? `Read and annotate: ${source.sentence}`
        : index % 3 === 1
          ? `Explain ${source.keyword} from memory, then verify with notes.`
          : `Solve one quick question on ${source.keyword} and check against evidence.`,
    citations: [
      {
        fileName: source.chunk.fileName,
        pageOrSection: source.chunk.pageOrSection,
        chunkId: source.chunk.chunkId,
      },
    ],
    evidence: [
      {
        fileName: source.chunk.fileName,
        pageOrSection: source.chunk.pageOrSection,
        textSnippet: source.sentence,
      },
    ],
  }));

  const focusTerms = queryTerms(params.focus || "");
  const commonTerms = expanded.map((item) => item.keyword).slice(0, 4);

  return {
    goalMinutes: params.goalMinutes,
    totalMinutes: plan.reduce((sum, item) => sum + item.durationMinutes, 0),
    plan,
    tips: [
      focusTerms.length > 0
        ? `Prioritize your focus terms first: ${focusTerms.slice(0, 3).join(", ")}.`
        : "Start with high-yield topics before detail-heavy sections.",
      `Use active recall on: ${commonTerms.join(", ")}.`,
      "End with a 3-minute recap from memory.",
    ],
  };
}

async function llmPlanner(params: { goalMinutes: number; focus?: string; sources: PlannerSource[] }) {
  const context = params.sources.map((source, index) => `${index + 1}. ${source.sentence}`).join("\n");

  const raw = await completeWithLLM({
    systemPrompt:
      "Create a concise study plan from note evidence only. Return JSON with plan (title,durationMinutes,task,sourceIndex) and tips.",
    userPrompt: `Goal minutes: ${params.goalMinutes}
Focus: ${params.focus || "General revision"}

Create 3-8 study blocks with realistic durations that sum near the goal.
Evidence:
${context}`,
    temperature: 0.25,
  });

  if (!raw) return null;

  const parsed = parseJsonBlock<{
    plan?: Array<{ title: string; durationMinutes: number; task: string; sourceIndex: number }>;
    tips?: string[];
  }>(raw);

  if (!parsed?.plan || parsed.plan.length === 0) return null;
  if (!parsed.plan.every((item) => item.title && item.task && Number.isFinite(item.durationMinutes))) return null;

  const plan = parsed.plan.slice(0, 8).map((item, index) => {
    const source = params.sources[Math.max(0, Math.min(params.sources.length - 1, (item.sourceIndex ?? index + 1) - 1))];
    return {
      title: truncate(item.title, 90),
      durationMinutes: Math.max(5, Math.min(90, Math.round(item.durationMinutes))),
      task: truncate(item.task, 220),
      citations: [
        {
          fileName: source.chunk.fileName,
          pageOrSection: source.chunk.pageOrSection,
          chunkId: source.chunk.chunkId,
        },
      ],
      evidence: [
        {
          fileName: source.chunk.fileName,
          pageOrSection: source.chunk.pageOrSection,
          textSnippet: source.sentence,
        },
      ],
    };
  });

  const tips = (parsed.tips || []).filter((tip) => typeof tip === "string" && tip.trim().length > 0).slice(0, 4);

  return {
    goalMinutes: params.goalMinutes,
    totalMinutes: plan.reduce((sum, item) => sum + item.durationMinutes, 0),
    plan,
    tips: tips.length > 0 ? tips : ["Revise high-yield topics first, then active recall."],
  } satisfies BoostPlannerResponsePayload;
}

export async function buildPlannerPayload(params: {
  goalMinutes: number;
  focus?: string;
  retrievedChunks: RetrievedChunk[];
}): Promise<BoostPlannerResponsePayload | null> {
  const sources = buildPlannerSources(params.retrievedChunks, 12);
  if (sources.length === 0) return null;

  if (isDemoMode()) {
    return deterministicPlanner({
      goalMinutes: params.goalMinutes,
      focus: params.focus,
      sources,
    });
  }

  return (
    (await llmPlanner({
      goalMinutes: params.goalMinutes,
      focus: params.focus,
      sources,
    })) ??
    deterministicPlanner({
      goalMinutes: params.goalMinutes,
      focus: params.focus,
      sources,
    })
  );
}
