"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  RefreshCw,
  RotateCcw,
  Shuffle,
} from "lucide-react";

import type { GradeResponsePayload, StudyResponsePayload } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type Subject = {
  id: string;
  name: string;
};

type DifficultyInput = "easy" | "medium" | "hard";

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyInput; label: string }> = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function StudyModePage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [loadingSubject, setLoadingSubject] = useState(true);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyInput>("medium");

  const [study, setStudy] = useState<StudyResponsePayload | null>(null);
  const [mcqAnswers, setMcqAnswers] = useState<number[]>([]);
  const [shortAnswers, setShortAnswers] = useState<string[]>([]);
  const [gradeResult, setGradeResult] = useState<GradeResponsePayload | null>(null);

  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingSubject(true);
      const response = await fetch(`/api/subjects/${subjectId}`);
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error || "Subject not found");
      } else {
        setSubject(payload.subject);
      }
      setLoadingSubject(false);
    })();
  }, [subjectId]);

  async function generateStudy() {
    setLoadingStudy(true);
    setGradeResult(null);
    setCardIndex(0);
    setCardFlipped(false);

    const variation = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const response = await fetch(`/api/subjects/${subjectId}/study?difficulty=${difficulty}&variation=${variation}`, {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error || "Could not generate study mode");
      setLoadingStudy(false);
      return;
    }

    setStudy(payload);
    setMcqAnswers(new Array(payload.mcqs.length).fill(-1));
    setShortAnswers(new Array(payload.shortAnswers.length).fill(""));
    setLoadingStudy(false);
    toast.success(`Study mode generated (${payload.difficulty})`);
  }

  async function submitForGrading() {
    if (!study) return;

    const hasPendingMcq = mcqAnswers.some((value) => value < 0);
    const hasPendingShort = shortAnswers.some((value) => value.trim().length === 0);
    if (hasPendingMcq || hasPendingShort) {
      toast.error("Complete all exam questions before submitting.");
      return;
    }

    setGrading(true);
    const response = await fetch(`/api/subjects/${subjectId}/study/grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        studyPack: study,
        mcqAnswers,
        shortAnswers,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error || "Failed to grade test");
      setGrading(false);
      return;
    }

    setGradeResult(payload);
    setGrading(false);
    toast.success("Exam checked and marks generated");
  }

  const attemptedMcqCount = useMemo(() => mcqAnswers.filter((value) => value >= 0).length, [mcqAnswers]);
  const attemptedShortCount = useMemo(
    () => shortAnswers.filter((value) => value.trim().length > 0).length,
    [shortAnswers],
  );

  const totalCards = study?.flashcards.length ?? 0;
  const activeCard = study?.flashcards[cardIndex];

  function goNextCard() {
    if (!totalCards) return;
    setCardFlipped(false);
    setCardIndex((prev) => (prev + 1) % totalCards);
  }

  function goPrevCard() {
    if (!totalCards) return;
    setCardFlipped(false);
    setCardIndex((prev) => (prev - 1 + totalCards) % totalCards);
  }

  function shuffleCards() {
    if (!totalCards) return;
    setCardFlipped(false);
    setCardIndex(Math.floor(Math.random() * totalCards));
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
          <Link href={`/app/subjects/${subjectId}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Study Mode {loadingSubject ? <Skeleton className="ml-2 inline-block h-7 w-28 align-middle" /> : subject?.name}
        </h1>
        <p className="text-sm text-zinc-600">Exam flow first, marks second. Flashcards unlock after exam submission.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Difficulty Level</CardTitle>
          <CardDescription>Choose your exam complexity before generating the test.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {DIFFICULTY_OPTIONS.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={difficulty === item.value ? "default" : "outline"}
              onClick={() => setDifficulty(item.value)}
              disabled={loadingStudy}
            >
              {item.label}
            </Button>
          ))}
          <Button onClick={generateStudy} disabled={loadingStudy}>
            <RefreshCw className={`h-4 w-4 ${loadingStudy ? "animate-spin" : ""}`} />
            {loadingStudy ? "Generating..." : study ? "Regenerate Exam" : "Generate Exam"}
          </Button>
          {study && <Badge variant="warning">Current: {study.difficulty}</Badge>}
        </CardContent>
      </Card>

      {loadingStudy ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : !study ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-zinc-600">
            Generate an exam once notes are uploaded for this subject.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Exam In Progress</Badge>
            <Badge variant="warning">
              Attempted: {attemptedMcqCount}/{study.mcqs.length} MCQ • {attemptedShortCount}/{study.shortAnswers.length} Short
            </Badge>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Multiple Choice Questions</h2>
            {study.mcqs.map((mcq, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Q{index + 1}. {mcq.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="space-y-2">
                      {mcq.options.map((option, optionIndex) => {
                        const selected = mcqAnswers[index] === optionIndex;
                        return (
                          <button
                            key={optionIndex}
                            type="button"
                            onClick={() =>
                              setMcqAnswers((prev) => {
                                const next = [...prev];
                                next[index] = optionIndex;
                                return next;
                              })
                            }
                            className={`w-full rounded-md border px-3 py-2 text-left transition ${
                              selected
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
                            }`}
                          >
                            <span className="font-medium">{String.fromCharCode(65 + optionIndex)}.</span> {option}
                          </button>
                        );
                      })}
                    </div>

                    {gradeResult && (
                      <>
                        <p className="rounded-md bg-zinc-100 p-2 text-xs text-zinc-700">
                          Correct: {String.fromCharCode(65 + mcq.correctOption)} • {mcq.explanation}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Citation: {mcq.citations[0]?.fileName} • {mcq.citations[0]?.pageOrSection} • {mcq.citations[0]?.chunkId}
                        </p>
                        <p className="rounded-md bg-zinc-100 p-2 text-xs text-zinc-600">Evidence: {mcq.evidence[0]?.textSnippet}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Short Answer Questions</h2>
            {study.shortAnswers.map((item, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Q{index + 1}. {item.question}
                    </CardTitle>
                    <CardDescription>Answer as if this is your exam paper.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Textarea
                      placeholder="Write your answer..."
                      value={shortAnswers[index] || ""}
                      onChange={(event) =>
                        setShortAnswers((prev) => {
                          const next = [...prev];
                          next[index] = event.target.value;
                          return next;
                        })
                      }
                    />
                    {gradeResult && (
                      <>
                        <p className="rounded-md bg-zinc-100 p-2 text-xs text-zinc-700">Model answer: {item.modelAnswer}</p>
                        <p className="text-xs text-zinc-500">
                          Citation: {item.citations[0]?.fileName} • {item.citations[0]?.pageOrSection} • {item.citations[0]?.chunkId}
                        </p>
                        <p className="rounded-md bg-zinc-100 p-2 text-xs text-zinc-600">Evidence: {item.evidence[0]?.textSnippet}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </section>

          <div className="flex items-center gap-2">
            <Button onClick={submitForGrading} disabled={grading}>
              {grading ? "Checking..." : "Submit Exam for Marks"}
            </Button>
            {gradeResult && (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Checked
              </Badge>
            )}
          </div>

          {gradeResult && (
            <Card>
              <CardHeader>
                <CardTitle>Marks</CardTitle>
                <CardDescription>
                  {gradeResult.obtainedMarks}/{gradeResult.totalMarks} ({gradeResult.percentage}%)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  MCQ: {gradeResult.mcq.correct}/{gradeResult.mcq.total} correct ({gradeResult.mcq.marks} marks)
                </p>
                <p>
                  Short Answers: Avg similarity {gradeResult.shortAnswers.averageSimilarity}% ({gradeResult.shortAnswers.marks} marks)
                </p>
                <div className="space-y-2">
                  {gradeResult.breakdown.map((item, index) => (
                    <div key={index} className="rounded-md border border-zinc-200 p-2">
                      <p className="font-medium">
                        {item.type.toUpperCase()} • {item.awardedMarks}/{item.maxMarks}
                      </p>
                      <p className="text-zinc-600">{item.question}</p>
                      <p className="text-xs text-zinc-500">{item.feedback}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Flashcards</h2>
            {!gradeResult ? (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center gap-2 p-6 text-sm text-zinc-600">
                  <Lock className="h-4 w-4" /> Submit exam first to unlock flashcards.
                </CardContent>
              </Card>
            ) : !activeCard ? (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-sm text-zinc-600">No flashcards available yet.</CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <motion.div
                  key={`${cardIndex}-${cardFlipped ? "back" : "front"}`}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-5 shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Card {cardIndex + 1}/{totalCards} • {cardFlipped ? "Back" : "Front"}
                  </p>
                  <p className="text-base font-medium text-zinc-900">{cardFlipped ? activeCard.back : activeCard.front}</p>
                  {cardFlipped && (
                    <p className="mt-3 text-xs text-zinc-500">
                      Citation: {activeCard.citations[0]?.fileName} • {activeCard.citations[0]?.pageOrSection}
                    </p>
                  )}
                </motion.div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={goPrevCard}>
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setCardFlipped((prev) => !prev)}>
                    <RotateCcw className="h-4 w-4" /> Flip
                  </Button>
                  <Button type="button" variant="outline" onClick={goNextCard}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" onClick={shuffleCards}>
                    <Shuffle className="h-4 w-4" /> Shuffle
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
