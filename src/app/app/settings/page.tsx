"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SettingsState = {
  mode: "demo" | "llm";
  provider: "openai" | "openrouter";
  llmEnabled: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState | null>(null);

  useEffect(() => {
    (async () => {
      const response = await fetch("/api/settings/status", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) {
        setSettings(payload);
      }
    })();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-600">Environment and mode diagnostics.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runtime Mode</CardTitle>
          <CardDescription>When API keys are absent, AskMyNotes runs in full demo mode with extractive answers.</CardDescription>
        </CardHeader>
        <CardContent>
          {!settings ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-64" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-zinc-600">Mode:</span>
                <Badge variant={settings.mode === "llm" ? "success" : "warning"}>
                  {settings.mode === "llm" ? "LLM Enabled" : "Demo Mode"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-600">Provider:</span>
                <Badge>{settings.provider}</Badge>
              </div>
              <p className="text-zinc-600">
                Demo mode still supports uploads, parsing, chunking, strict retrieval, not-found gating, citations, and study mode.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
