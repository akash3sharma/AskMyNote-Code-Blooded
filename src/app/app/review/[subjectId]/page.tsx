"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, RefreshCw, Repeat2, RotateCcw } from "lucide-react";

import type { ReviewQueueResponsePayload, ReviewRating, ReviewSeedResponsePayload, ReviewStatsPayload } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Subject = {
  id: string;
  name: string;
};

const EMPTY_STATS: ReviewStatsPayload = {
  totalCards: 0,
  dueCount: 0,
  reviewedToday: 0,
  nextDueAt: null,
};

async function readJsonSafe(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: "Unexpected response from server." };
  }
}

function formatDate(value: string | null) {
  if (!value) return "No upcoming reviews";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No upcoming reviews";
  return date.toLocaleString();
}

export default function ReviewPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [loadingSubject, setLoadingSubject] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [grading, setGrading] = useState<ReviewRating | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);

  const [stats, setStats] = useState<ReviewStatsPayload>(EMPTY_STATS);
  const [dueCards, setDueCards] = useState<ReviewQueueResponsePayload["dueCards"]>([]);

  const safeIndex = dueCards.length === 0 ? 0 : Math.min(cardIndex, dueCards.length - 1);
  const activeCard = dueCards[safeIndex] || null;

  const loadQueue = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingQueue(true);
      const response = await fetch(`/api/subjects/${subjectId}/review?limit=20`, { cache: "no-store" });
      const payload = (await readJsonSafe(response)) as Partial<ReviewQueueResponsePayload> & { error?: string };

      if (!response.ok) {
        toast.error(payload.error || "Failed to load review queue");
        if (!silent) setLoadingQueue(false);
        return;
      }

      setStats(payload.stats || EMPTY_STATS);
      setDueCards(Array.isArray(payload.dueCards) ? payload.dueCards : []);
      setCardIndex(0);
      setRevealed(false);
      if (!silent) setLoadingQueue(false);
    },
    [subjectId],
  );

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
      await loadQueue();
    })();
  }, [loadQueue, subjectId]);

  async function seedDeck() {
    setSeeding(true);
    const response = await fetch(`/api/subjects/${subjectId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: 45 }),
    });
    const payload = (await readJsonSafe(response)) as Partial<ReviewSeedResponsePayload> & { error?: string };

    if (!response.ok) {
      toast.error(payload.error || "Failed to prepare review deck");
      setSeeding(false);
      return;
    }

    setStats(payload.stats || EMPTY_STATS);
    setDueCards(Array.isArray(payload.dueCards) ? payload.dueCards : []);
    setCardIndex(0);
    setRevealed(false);
    setSeeding(false);
    toast.success(`Deck ready. Added ${payload.createdCards ?? 0} new cards.`);
  }

  async function submitRating(rating: ReviewRating) {
    if (!activeCard || grading) return;

    setGrading(rating);
    const response = await fetch(`/api/subjects/${subjectId}/review/${activeCard.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    const payload = await readJsonSafe(response);

    if (!response.ok) {
      toast.error((payload.error as string) || "Could not submit rating");
      setGrading(null);
      return;
    }

    setGrading(null);
    await loadQueue(true);
    toast.success(`Saved: ${rating.toUpperCase()}`);
  }

  const progress = useMemo(() => {
    if (dueCards.length === 0) return "0/0";
    return `${safeIndex + 1}/${dueCards.length}`;
  }, [safeIndex, dueCards.length]);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
          <Link href={`/app/subjects/${subjectId}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Spaced Repetition {loadingSubject ? <Skeleton className="ml-2 inline-block h-7 w-28 align-middle" /> : subject?.name}
        </h1>
        <p className="text-sm text-zinc-600">Review due cards daily to improve long-term memorization.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revision Queue</CardTitle>
          <CardDescription>Generate cards from your notes and review with Again / Hard / Good / Easy ratings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={seedDeck} disabled={seeding}>
              <Repeat2 className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
              {seeding ? "Preparing..." : "Prepare Deck"}
            </Button>
            <Button variant="outline" onClick={() => loadQueue()} disabled={loadingQueue}>
              <RefreshCw className={`h-4 w-4 ${loadingQueue ? "animate-spin" : ""}`} />
              Refresh Due
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Total Cards: {stats.totalCards}</Badge>
            <Badge variant={stats.dueCount > 0 ? "warning" : "success"}>Due Now: {stats.dueCount}</Badge>
            <Badge variant="success">Reviewed Today: {stats.reviewedToday}</Badge>
          </div>
          <p className="text-xs text-zinc-500">Next due: {formatDate(stats.nextDueAt)}</p>
        </CardContent>
      </Card>

      {loadingQueue ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : dueCards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-zinc-600">
            <p>No cards due right now.</p>
            <p className="mt-2 text-xs text-zinc-500">Use &apos;Prepare Deck&apos; after uploading notes, then come back for daily revision.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="warning">Card {progress}</Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCardIndex((prev) => (prev + 1) % dueCards.length);
                setRevealed(false);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Skip
            </Button>
          </div>

          {activeCard && (
            <motion.div
              key={activeCard.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{activeCard.prompt}</CardTitle>
                  <CardDescription>
                    {activeCard.fileName} • {activeCard.pageOrSection}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>Repetitions: {activeCard.repetitions}</span>
                    <span>Interval: {activeCard.intervalDays} day(s)</span>
                    <span>Ease: {activeCard.easeFactor.toFixed(2)}</span>
                    <span>Lapses: {activeCard.lapses}</span>
                  </div>

                  {!revealed ? (
                    <Button onClick={() => setRevealed(true)}>Reveal Answer</Button>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-zinc-800">{activeCard.answer}</p>
                      <p className="text-xs text-zinc-500">Evidence: {activeCard.evidenceSnippet}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {revealed && (
                <div className="grid gap-2 md:grid-cols-4">
                  <Button variant="danger" disabled={Boolean(grading)} onClick={() => submitRating("again")}>
                    {grading === "again" ? "Saving..." : "Again"}
                  </Button>
                  <Button variant="outline" disabled={Boolean(grading)} onClick={() => submitRating("hard")}>
                    {grading === "hard" ? "Saving..." : "Hard"}
                  </Button>
                  <Button variant="secondary" disabled={Boolean(grading)} onClick={() => submitRating("good")}>
                    {grading === "good" ? "Saving..." : "Good"}
                  </Button>
                  <Button disabled={Boolean(grading)} onClick={() => submitRating("easy")}>
                    {grading === "easy" ? "Saving..." : "Easy"}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-600">
        <p className="flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5" />
          Tip: Review daily. Choose &apos;Again&apos; only when you fail recall. &apos;Good&apos; is your default memory rating.
        </p>
      </div>
    </div>
  );
}
