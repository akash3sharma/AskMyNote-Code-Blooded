"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { SubjectCard } from "@/components/app/subject-card";
import { SubjectCreateForm } from "@/components/app/subject-create-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SubjectItem = {
  id: string;
  name: string;
  slot: number;
  fileCount: number;
};

export default function DashboardPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubjects = useCallback(async () => {
    const response = await fetch("/api/subjects", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error || "Failed to load subjects");
      return;
    }

    setSubjects(payload.subjects);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadSubjects();
      setLoading(false);
    })();
  }, [loadSubjects]);

  const maxedOut = subjects.length >= 3;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-600">Create exactly 3 subjects, upload notes, then chat or generate study mode.</p>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle>Subjects ({subjects.length}/3)</CardTitle>
          <CardDescription>Subject limit is strictly enforced in UI, API, and database slots.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SubjectCreateForm disabled={maxedOut} onCreated={loadSubjects} />
          {maxedOut && <p className="text-xs text-zinc-500">All 3 slots are filled. Use existing subjects below.</p>}
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-zinc-600">No subjects yet. Add your first subject to begin.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject, index) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
            >
              <SubjectCard {...subject} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
