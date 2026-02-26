"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Clock3, FileWarning, Link2, Repeat2, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SubjectResponse = {
  subject: {
    id: string;
    name: string;
    slot: number;
  };
};

type FileItem = {
  id: string;
  fileName: string;
  parseStatus: "processing" | "parsed" | "error";
  sectionsCount: number;
  chunksCount: number;
  errorMessage: string;
  createdAt: string;
};

export default function SubjectDetailPage() {
  const params = useParams<{ id: string }>();
  const subjectId = params.id;

  const [subject, setSubject] = useState<SubjectResponse["subject"] | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeLoading, setYoutubeLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [subjectRes, fileRes] = await Promise.all([
      fetch(`/api/subjects/${subjectId}`, { cache: "no-store" }),
      fetch(`/api/subjects/${subjectId}/files`, { cache: "no-store" }),
    ]);

    const [subjectPayload, filePayload] = await Promise.all([subjectRes.json(), fileRes.json()]);

    if (!subjectRes.ok) {
      toast.error(subjectPayload.error || "Subject not found");
      return;
    }
    if (!fileRes.ok) {
      toast.error(filePayload.error || "Failed to load files");
      return;
    }

    setSubject(subjectPayload.subject);
    setFiles(filePayload.files);
  }, [subjectId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", selected);
      const response = await fetch(`/api/subjects/${subjectId}/files`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error || "Upload failed");
        return;
      }

      toast.success("File uploaded and parsed");
      await loadData();
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function onYoutubeSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = youtubeUrl.trim();
    if (!trimmed || youtubeLoading) return;

    setYoutubeLoading(true);
    try {
      const response = await fetch(`/api/subjects/${subjectId}/youtube`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error || "Could not import YouTube transcript");
        return;
      }

      toast.success("YouTube transcript imported");
      setYoutubeUrl("");
      await loadData();
    } finally {
      setYoutubeLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
            <Link href="/app">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-zinc-900">{subject?.name || "Subject"}</h1>
          <p className="text-sm text-zinc-600">Upload PDF/TXT notes for this subject only.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/app/chat/${subjectId}`}>Open Chat</Link>
          </Button>
          <Button asChild>
            <Link href={`/app/study/${subjectId}`}>Study Mode</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/app/lab/${subjectId}`}>AI Lab</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/app/review/${subjectId}`}>
              <Repeat2 className="h-4 w-4" />
              Review
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Notes</CardTitle>
          <CardDescription>Supported: file upload (`.pdf`, `.txt`, `.md`) or YouTube URL transcript import.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-700 hover:bg-zinc-100">
            <UploadCloud className="h-4 w-4" />
            {uploading ? "Uploading..." : "Click to upload"}
            <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={onFileChange} disabled={uploading} />
          </label>

          <form onSubmit={onYoutubeSubmit} className="flex flex-col gap-2 md:flex-row">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="Paste YouTube URL (with captions)"
              className="h-10 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none ring-offset-2 focus:ring-2 focus:ring-zinc-400"
            />
            <Button type="submit" variant="secondary" disabled={!youtubeUrl.trim() || youtubeLoading}>
              <Link2 className="h-4 w-4" />
              {youtubeLoading ? "Importing..." : "Import YouTube"}
            </Button>
          </form>
          <p className="text-xs text-zinc-500">
            The video transcript is parsed into chunks and works exactly like uploaded documents for chat, study mode, and AI Lab.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>Parse status and chunking progress.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-600">
              No files yet. Upload the first note to activate chat retrieval.
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{file.fileName}</p>
                    <p className="text-xs text-zinc-500">
                      {file.sectionsCount} sections • {file.chunksCount} chunks
                    </p>
                    {file.errorMessage && <p className="text-xs text-red-600">{file.errorMessage}</p>}
                  </div>

                  <Badge
                    variant={
                      file.parseStatus === "parsed" ? "success" : file.parseStatus === "processing" ? "warning" : "danger"
                    }
                    className="capitalize"
                  >
                    {file.parseStatus === "parsed" && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                    {file.parseStatus === "processing" && <Clock3 className="mr-1 h-3.5 w-3.5" />}
                    {file.parseStatus === "error" && <FileWarning className="mr-1 h-3.5 w-3.5" />}
                    {file.parseStatus}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
