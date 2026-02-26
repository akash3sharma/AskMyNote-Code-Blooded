"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    title: "Strict Subject Retrieval",
    body: "Answers are forced to come only from the selected subject.",
    icon: ShieldCheck,
  },
  {
    title: "Evidence-Backed Responses",
    body: "Every answer includes citations, confidence, and top snippets.",
    icon: BookOpen,
  },
  {
    title: "Study Mode",
    body: "Instant MCQs and short-answer sets from your own notes.",
    icon: Sparkles,
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-500 p-2 text-white shadow-lg shadow-sky-300/50">
            A
          </div>
          <span className="font-semibold text-zinc-900">AskMyNotes</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/auth/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/signup">Get Started</Link>
          </Button>
        </div>
      </header>

      <section className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[1.2fr_1fr] md:py-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <p className="mb-3 inline-flex rounded-full border border-zinc-300/80 bg-white/70 px-3 py-1 text-xs text-zinc-600 backdrop-blur">
            Retrieval-first note assistant
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl">
            Chat with your notes. Study with evidence.
          </h1>
          <p className="mt-4 max-w-xl text-zinc-600">
            Upload PDFs or text notes into exactly 3 subjects. Ask questions with strict note-only grounding and confidence-aware responses.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/auth/signup">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/login">Open Dashboard</Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="space-y-3"
        >
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="overflow-hidden border-zinc-200/80">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 p-2 text-white shadow-md shadow-sky-300/40">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900">{feature.title}</p>
                    <p className="text-sm text-zinc-600">{feature.body}</p>
                  </div>
                  <span className="ml-auto text-xs font-medium text-zinc-400">0{index + 1}</span>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
      </section>
    </main>
  );
}
