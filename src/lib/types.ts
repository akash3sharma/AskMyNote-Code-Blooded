export type Confidence = "High" | "Medium" | "Low";

export type Citation = {
  fileName: string;
  pageOrSection: string;
  chunkId: string;
};

export type EvidenceSnippet = {
  fileName: string;
  pageOrSection: string;
  textSnippet: string;
};

export type ChatResponsePayload = {
  answer: string;
  confidence: Confidence;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
};

export type ParsedSection = {
  pageOrSection: string;
  text: string;
};

export type ChunkRecord = {
  chunkId: string;
  fileName: string;
  pageOrSection: string;
  text: string;
  embedding: number[];
  subjectId: string;
  fileId: string;
};

export type RetrievedChunk = ChunkRecord & {
  score: number;
};

export type StudyMCQ = {
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type StudyShortAnswer = {
  question: string;
  modelAnswer: string;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type StudyFlashcard = {
  front: string;
  back: string;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type StudyDifficulty = "Easy" | "Medium" | "Hard";

export type StudyResponsePayload = {
  difficulty: StudyDifficulty;
  mcqs: StudyMCQ[];
  shortAnswers: StudyShortAnswer[];
  flashcards: StudyFlashcard[];
};

export type GradeRequestPayload = {
  studyPack: StudyResponsePayload;
  mcqAnswers: number[];
  shortAnswers: string[];
};

export type GradeResponsePayload = {
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  mcq: {
    correct: number;
    total: number;
    marks: number;
  };
  shortAnswers: {
    averageSimilarity: number;
    total: number;
    marks: number;
  };
  breakdown: Array<{
    type: "mcq" | "short";
    question: string;
    awardedMarks: number;
    maxMarks: number;
    feedback: string;
  }>;
};

export type AiLabConcept = {
  title: string;
  summary: string;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type AiLabFlashcard = {
  front: string;
  back: string;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type AiLabRevisionTask = {
  day: number;
  focus: string;
  task: string;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type AiLabResponsePayload = {
  keyConcepts: AiLabConcept[];
  flashcards: AiLabFlashcard[];
  revisionPlan: AiLabRevisionTask[];
};

export type CoachResponsePayload = {
  score: number;
  verdict: "Excellent" | "Good" | "Needs Work";
  feedback: string;
  missingPoints: string[];
  improvedAnswer: string;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type BoostSearchHit = {
  fileName: string;
  pageOrSection: string;
  chunkId: string;
  score: number;
  textSnippet: string;
};

export type BoostSearchResponsePayload = {
  query: string;
  totalHits: number;
  hits: BoostSearchHit[];
};

export type BoostExplainResponsePayload = {
  concept: string;
  oneLiner: string;
  simple: string;
  examReady: string;
  confidence: Confidence;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type BoostPlannerItem = {
  title: string;
  durationMinutes: number;
  task: string;
  citations: Citation[];
  evidence: EvidenceSnippet[];
};

export type BoostPlannerResponsePayload = {
  goalMinutes: number;
  totalMinutes: number;
  plan: BoostPlannerItem[];
  tips: string[];
};

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type ReviewCardPayload = {
  id: string;
  chunkId: string;
  fileName: string;
  pageOrSection: string;
  prompt: string;
  answer: string;
  evidenceSnippet: string;
  dueAt: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
  reviewCount: number;
  lastRating: ReviewRating | null;
};

export type ReviewStatsPayload = {
  totalCards: number;
  dueCount: number;
  reviewedToday: number;
  nextDueAt: string | null;
};

export type ReviewQueueResponsePayload = {
  stats: ReviewStatsPayload;
  dueCards: ReviewCardPayload[];
};

export type ReviewSeedResponsePayload = ReviewQueueResponsePayload & {
  createdCards: number;
};
