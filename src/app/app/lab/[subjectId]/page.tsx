"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, BrainCircuit, Layers3, RefreshCw, Search, Sparkles, TimerReset, Wand2, Zap } from "lucide-react";

import type {
  AiLabResponsePayload,
  BoostExplainResponsePayload,
  BoostPlannerResponsePayload,
  BoostSearchResponsePayload,
  CoachResponsePayload,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type Subject = {
  id: string;
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAiLabPayload(value: unknown): value is AiLabResponsePayload {
  if (!isRecord(value)) return false;
  return Array.isArray(value.keyConcepts) && Array.isArray(value.flashcards) && Array.isArray(value.revisionPlan);
}

function isCoachPayload(value: unknown): value is CoachResponsePayload {
  if (!isRecord(value)) return false;
  return typeof value.score === "number" && typeof value.verdict === "string" && typeof value.improvedAnswer === "string";
}

function isSearchPayload(value: unknown): value is BoostSearchResponsePayload {
  if (!isRecord(value)) return false;
  return typeof value.query === "string" && typeof value.totalHits === "number" && Array.isArray(value.hits);
}

function isExplainPayload(value: unknown): value is BoostExplainResponsePayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.concept === "string" &&
    typeof value.oneLiner === "string" &&
    typeof value.simple === "string" &&
    typeof value.examReady === "string"
  );
}

function isPlannerPayload(value: unknown): value is BoostPlannerResponsePayload {
  if (!isRecord(value)) return false;
  return typeof value.goalMinutes === "number" && typeof value.totalMinutes === "number" && Array.isArray(value.plan);
}

async function readJsonSafe(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: "Unexpected response from server." };
  }
}

export default function AiLabPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [loadingSubject, setLoadingSubject] = useState(true);
  const [loadingLab, setLoadingLab] = useState(false);
  const [lab, setLab] = useState<AiLabResponsePayload | null>(null);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachAnswer, setCoachAnswer] = useState("");
  const [coaching, setCoaching] = useState(false);
  const [coachResult, setCoachResult] = useState<CoachResponsePayload | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<BoostSearchResponsePayload | null>(null);

  const [explainConcept, setExplainConcept] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [explainResult, setExplainResult] = useState<BoostExplainResponsePayload | null>(null);

  const [plannerGoal, setPlannerGoal] = useState(45);
  const [plannerFocus, setPlannerFocus] = useState("");
  const [planning, setPlanning] = useState(false);
  const [plannerResult, setPlannerResult] = useState<BoostPlannerResponsePayload | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingSubject(true);
      const response = await fetch(`/api/subjects/${subjectId}`);
      const payload = await readJsonSafe(response);
      if (!response.ok) {
        toast.error((payload.error as string) || "Subject not found");
      } else {
        setSubject(payload.subject as Subject);
      }
      setLoadingSubject(false);
    })();
  }, [subjectId]);

  async function generateLab() {
    setLoadingLab(true);
    setCoachResult(null);
    const response = await fetch(`/api/subjects/${subjectId}/ai-lab`, { cache: "no-store" });
    const payload = (await readJsonSafe(response)) as Partial<AiLabResponsePayload> & { error?: string };

    if (!response.ok) {
      toast.error(payload.error || "Could not generate AI Lab");
      setLoadingLab(false);
      return;
    }

    if (!isAiLabPayload(payload)) {
      toast.error("Unexpected AI Lab response from server");
      setLoadingLab(false);
      return;
    }

    setLab(payload);
    setFlippedCards({});
    setLoadingLab(false);
    toast.success("AI Lab generated");
  }

  async function runCoach(event: FormEvent) {
    event.preventDefault();
    if (!coachQuestion.trim() || !coachAnswer.trim()) {
      toast.error("Add both question and your answer.");
      return;
    }

    setCoaching(true);
    const response = await fetch(`/api/subjects/${subjectId}/ai-lab/coach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: coachQuestion,
        answer: coachAnswer,
      }),
    });
    const payload = (await readJsonSafe(response)) as Partial<CoachResponsePayload> & { error?: string };

    if (!response.ok) {
      toast.error(payload.error || "Coach could not evaluate answer");
      setCoaching(false);
      return;
    }

    if (!isCoachPayload(payload)) {
      toast.error("Unexpected coach response from server");
      setCoaching(false);
      return;
    }

    setCoachResult(payload);
    setCoaching(false);
    toast.success("Answer reviewed");
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed || searching) return;

    setSearching(true);
    const response = await fetch(`/api/subjects/${subjectId}/boost/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: trimmed, limit: 8 }),
    });
    const payload = (await readJsonSafe(response)) as Partial<BoostSearchResponsePayload> & { error?: string };

    if (!response.ok) {
      toast.error(payload.error || "Smart search failed");
      setSearching(false);
      return;
    }

    if (!isSearchPayload(payload)) {
      toast.error("Unexpected search response from server");
      setSearching(false);
      return;
    }

    setSearchResult(payload);
    setSearching(false);
    toast.success(payload.totalHits > 0 ? "Search results ready" : "No direct hits found");
  }

  async function runExplain(event: FormEvent) {
    event.preventDefault();
    const trimmed = explainConcept.trim();
    if (!trimmed || explaining) return;

    setExplaining(true);
    const response = await fetch(`/api/subjects/${subjectId}/boost/explain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ concept: trimmed }),
    });
    const payload = (await readJsonSafe(response)) as Partial<BoostExplainResponsePayload> & { error?: string };

    if (!response.ok) {
      toast.error(payload.error || "Concept explainer failed");
      setExplaining(false);
      return;
    }

    if (!isExplainPayload(payload)) {
      toast.error("Unexpected concept response from server");
      setExplaining(false);
      return;
    }

    setExplainResult(payload);
    setExplaining(false);
    toast.success("Concept explained");
  }

  async function runPlanner(event: FormEvent) {
    event.preventDefault();
    if (planning) return;

    setPlanning(true);
    const response = await fetch(`/api/subjects/${subjectId}/boost/planner`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goalMinutes: plannerGoal,
        focus: plannerFocus.trim() || undefined,
      }),
    });
    const payload = (await readJsonSafe(response)) as Partial<BoostPlannerResponsePayload> & { error?: string };

    if (!response.ok) {
      toast.error(payload.error || "Planner generation failed");
      setPlanning(false);
      return;
    }

    if (!isPlannerPayload(payload)) {
      toast.error("Unexpected planner response from server");
      setPlanning(false);
      return;
    }

    setPlannerResult(payload);
    setPlanning(false);
    toast.success("Study planner generated");
  }

  const coachTone = useMemo(() => {
    if (!coachResult) return "bg-zinc-200";
    if (coachResult.score >= 80) return "bg-emerald-500";
    if (coachResult.score >= 55) return "bg-amber-500";
    return "bg-rose-500";
  }, [coachResult]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
          <Link href={`/app/subjects/${subjectId}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-zinc-900">
          AI Lab {loadingSubject ? <Skeleton className="ml-2 inline-block h-7 w-28 align-middle" /> : subject?.name}
        </h1>
        <p className="text-sm text-zinc-600">Flashcards, concept map, revision plan, and answer coaching from this subject only.</p>
      </motion.div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generateLab} disabled={loadingLab}>
          <RefreshCw className={`h-4 w-4 ${loadingLab ? "animate-spin" : ""}`} />
          {loadingLab ? "Generating..." : lab ? "Regenerate AI Lab" : "Generate AI Lab"}
        </Button>
        <Badge variant="default">
          <BrainCircuit className="mr-1 h-3.5 w-3.5" />
          Subject-Scoped
        </Badge>
      </div>

      {loadingLab ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : !lab ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-zinc-600">
            Generate AI Lab once your notes are uploaded for this subject.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <Sparkles className="h-4 w-4" /> Key Concepts
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lab.keyConcepts.map((concept, index) => (
                <motion.div
                  key={`${concept.title}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                  whileHover={{ y: -3, scale: 1.01 }}
                >
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">{concept.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-zinc-700">
                      <p>{concept.summary}</p>
                      <p className="text-xs text-zinc-500">
                        {concept.citations[0]?.fileName} • {concept.citations[0]?.pageOrSection}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <Layers3 className="h-4 w-4" /> Flashcards
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {lab.flashcards.map((card, index) => {
                const flipped = flippedCards[index] ?? false;
                return (
                  <motion.button
                    key={`${card.front}-${index}`}
                    type="button"
                    onClick={() => setFlippedCards((prev) => ({ ...prev, [index]: !prev[index] }))}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    whileHover={{ y: -3 }}
                    className="h-44 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-3 text-left shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800"
                  >
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {flipped ? "Answer" : "Question"}
                    </p>
                    <p className="text-sm text-zinc-800">{flipped ? card.back : card.front}</p>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <Wand2 className="h-4 w-4" /> 3-Day Revision Plan
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {lab.revisionPlan.map((item, index) => (
                <motion.div
                  key={`${item.day}-${item.focus}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: index * 0.05 }}
                >
                  <Card className="h-full border-zinc-200">
                    <CardHeader>
                      <CardTitle className="text-base">Day {item.day}</CardTitle>
                      <CardDescription>{item.focus}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-zinc-700">
                      <p>{item.task}</p>
                      <p className="text-xs text-zinc-500">
                        {item.citations[0]?.fileName} • {item.citations[0]?.pageOrSection}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Answer Coach</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Get feedback on your answer</CardTitle>
                <CardDescription>Coach checks your response against note evidence and suggests an improved answer.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={runCoach}>
                  <Textarea
                    placeholder="Question (e.g. What is learning?)"
                    rows={2}
                    value={coachQuestion}
                    onChange={(event) => setCoachQuestion(event.target.value)}
                  />
                  <Textarea
                    placeholder="Write your answer..."
                    rows={4}
                    value={coachAnswer}
                    onChange={(event) => setCoachAnswer(event.target.value)}
                  />
                  <Button type="submit" disabled={coaching}>
                    {coaching ? "Evaluating..." : "Evaluate Answer"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {coachResult && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Coach Result</CardTitle>
                    <CardDescription>{coachResult.verdict}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                      <motion.div
                        className={`h-full ${coachTone}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${coachResult.score}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="font-medium text-zinc-800">Score: {coachResult.score}/100</p>
                    <p className="text-zinc-700">{coachResult.feedback}</p>
                    {coachResult.missingPoints.length > 0 && (
                      <p className="text-zinc-700">Missing points: {coachResult.missingPoints.join(", ")}</p>
                    )}
                    <p className="rounded-md bg-zinc-100 p-2 text-zinc-700">
                      <span className="font-medium">Improved answer:</span> {coachResult.improvedAnswer}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Citation: {coachResult.citations[0]?.fileName || "N/A"} • {coachResult.citations[0]?.pageOrSection || "N/A"}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
              <Zap className="h-4 w-4" /> Productivity Boost
            </h2>

            <div className="grid gap-4 xl:grid-cols-3">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Smart Search</CardTitle>
                    <CardDescription>Find exact note evidence quickly.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <form onSubmit={runSearch} className="space-y-2">
                      <Textarea
                        placeholder="Search in your notes..."
                        rows={2}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                      />
                      <Button type="submit" disabled={searching || !searchQuery.trim()}>
                        <Search className="h-4 w-4" />
                        {searching ? "Searching..." : "Search"}
                      </Button>
                    </form>

                    {searchResult && (
                      <div className="space-y-2 text-sm">
                        <p className="text-xs text-zinc-500">
                          Hits: {searchResult.totalHits} for {searchResult.query}
                        </p>
                        {searchResult.hits.length === 0 ? (
                          <p className="rounded-md border border-dashed p-2 text-zinc-600">No direct evidence hit found.</p>
                        ) : (
                          searchResult.hits.slice(0, 4).map((hit, index) => (
                            <div key={`${hit.chunkId}-${index}`} className="rounded-md border border-zinc-200 p-2">
                              <p className="mb-1 text-xs text-zinc-500">
                                {hit.fileName} • {hit.pageOrSection} • score {hit.score}
                              </p>
                              <p className="text-zinc-700">{hit.textSnippet}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Concept Explainer</CardTitle>
                    <CardDescription>One-liner, simple, and exam-ready explanation.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <form onSubmit={runExplain} className="space-y-2">
                      <Textarea
                        placeholder="Concept to explain (e.g. recursion)"
                        rows={2}
                        value={explainConcept}
                        onChange={(event) => setExplainConcept(event.target.value)}
                      />
                      <Button type="submit" disabled={explaining || !explainConcept.trim()}>
                        {explaining ? "Explaining..." : "Explain"}
                      </Button>
                    </form>

                    {explainResult && (
                      <div className="space-y-2 text-sm">
                        <Badge
                          variant={
                            explainResult.confidence === "High"
                              ? "success"
                              : explainResult.confidence === "Medium"
                                ? "warning"
                                : "danger"
                          }
                        >
                          Confidence: {explainResult.confidence}
                        </Badge>
                        <p className="rounded-md bg-zinc-100 p-2">
                          <span className="font-medium">One-line:</span> {explainResult.oneLiner}
                        </p>
                        <p className="rounded-md bg-zinc-100 p-2">
                          <span className="font-medium">Simple:</span> {explainResult.simple}
                        </p>
                        <p className="rounded-md bg-zinc-100 p-2">
                          <span className="font-medium">Exam-ready:</span> {explainResult.examReady}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Study Planner</CardTitle>
                    <CardDescription>Time-boxed plan from your own notes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <form onSubmit={runPlanner} className="space-y-2">
                      <label className="text-xs text-zinc-600">
                        Goal Minutes
                        <input
                          type="number"
                          min={15}
                          max={240}
                          step={5}
                          value={plannerGoal}
                          onChange={(event) => setPlannerGoal(Math.max(15, Math.min(240, Number(event.target.value) || 45)))}
                          className="mt-1 h-9 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none ring-offset-2 focus:ring-2 focus:ring-zinc-400"
                        />
                      </label>
                      <Textarea
                        placeholder="Optional focus (e.g. dynamic programming)"
                        rows={2}
                        value={plannerFocus}
                        onChange={(event) => setPlannerFocus(event.target.value)}
                      />
                      <Button type="submit" disabled={planning}>
                        <TimerReset className="h-4 w-4" />
                        {planning ? "Planning..." : "Generate Planner"}
                      </Button>
                    </form>

                    {plannerResult && (
                      <div className="space-y-2 text-sm">
                        <p className="text-xs text-zinc-500">
                          {plannerResult.totalMinutes}/{plannerResult.goalMinutes} minutes planned
                        </p>
                        {plannerResult.plan.slice(0, 4).map((item, index) => (
                          <div key={`${item.title}-${index}`} className="rounded-md border border-zinc-200 p-2">
                            <p className="font-medium text-zinc-800">
                              {item.title} ({item.durationMinutes} min)
                            </p>
                            <p className="text-zinc-700">{item.task}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
