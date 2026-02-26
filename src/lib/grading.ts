import { tokenize } from "@/lib/utils";
import type { GradeRequestPayload, GradeResponsePayload } from "@/lib/types";

const MCQ_MARK_PER_QUESTION = 1;
const SHORT_MARK_PER_QUESTION = 5;

function jaccardSimilarity(a: string, b: string) {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));

  if (aSet.size === 0 || bSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const item of aSet) {
    if (bSet.has(item)) {
      intersection += 1;
    }
  }

  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function gradeStudySubmission(payload: GradeRequestPayload): GradeResponsePayload {
  const mcqs = payload.studyPack.mcqs.slice(0, 5);
  const shorts = payload.studyPack.shortAnswers.slice(0, 3);

  let mcqCorrect = 0;
  let shortMarks = 0;

  const breakdown: GradeResponsePayload["breakdown"] = [];

  mcqs.forEach((mcq, index) => {
    const selected = payload.mcqAnswers[index] ?? -1;
    const correct = selected === mcq.correctOption;

    if (correct) {
      mcqCorrect += 1;
    }

    breakdown.push({
      type: "mcq",
      question: mcq.question,
      awardedMarks: correct ? MCQ_MARK_PER_QUESTION : 0,
      maxMarks: MCQ_MARK_PER_QUESTION,
      feedback: correct
        ? "Correct answer selected."
        : `Incorrect. Correct option is ${String.fromCharCode(65 + mcq.correctOption)}.`,
    });
  });

  const similarities: number[] = [];

  shorts.forEach((item, index) => {
    const provided = payload.shortAnswers[index] || "";
    const similarity = jaccardSimilarity(provided, item.modelAnswer);
    similarities.push(similarity);

    const awarded = clamp(Math.round(similarity * SHORT_MARK_PER_QUESTION * 100) / 100, 0, SHORT_MARK_PER_QUESTION);
    shortMarks += awarded;

    breakdown.push({
      type: "short",
      question: item.question,
      awardedMarks: awarded,
      maxMarks: SHORT_MARK_PER_QUESTION,
      feedback:
        similarity >= 0.55
          ? "Good coverage of the model answer."
          : similarity >= 0.3
            ? "Partially correct. Include more key points from notes."
            : "Low match with expected notes-based answer.",
    });
  });

  const mcqMarks = mcqCorrect * MCQ_MARK_PER_QUESTION;
  const totalMarks = mcqs.length * MCQ_MARK_PER_QUESTION + shorts.length * SHORT_MARK_PER_QUESTION;
  const obtainedMarks = Math.round((mcqMarks + shortMarks) * 100) / 100;
  const percentage = totalMarks === 0 ? 0 : Math.round((obtainedMarks / totalMarks) * 10000) / 100;
  const averageSimilarity = similarities.length
    ? Math.round((similarities.reduce((sum, value) => sum + value, 0) / similarities.length) * 10000) / 100
    : 0;

  return {
    totalMarks,
    obtainedMarks,
    percentage,
    mcq: {
      correct: mcqCorrect,
      total: mcqs.length,
      marks: mcqMarks,
    },
    shortAnswers: {
      averageSimilarity,
      total: shorts.length,
      marks: Math.round(shortMarks * 100) / 100,
    },
    breakdown,
  };
}
