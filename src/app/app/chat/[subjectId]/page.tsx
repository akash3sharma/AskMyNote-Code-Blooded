"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Bot, Loader2, Mic, Send, Square, User, Volume2, VolumeX } from "lucide-react";

import type { ChatResponsePayload, ChatTurn } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cleanText, normalizeVoiceTranscript } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  text: string;
  payload?: ChatResponsePayload;
};

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  [index: number]: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex?: number;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous?: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const AUTO_SPEAK_KEY = "askmynotes-auto-speak";

function recognitionErrorMessage(error?: string) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission is blocked. Allow it in browser settings and OS privacy settings.";
    case "audio-capture":
      return "No microphone device detected. Connect a mic and try again.";
    case "no-speech":
      return "No speech detected. Speak clearly and try again.";
    case "network":
      return "Speech recognition network error. Check connection and try again.";
    case "language-not-supported":
      return "Selected speech language is not supported by this browser.";
    default:
      return "Could not capture speech. Try again.";
  }
}

export default function SubjectChatPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;

  const [subjectName, setSubjectName] = useState("Subject");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loadingSubject, setLoadingSubject] = useState(true);
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [supportsSpeechInput, setSupportsSpeechInput] = useState(false);
  const [supportsMediaRecorder, setSupportsMediaRecorder] = useState(false);
  const [supportsSpeechOutput, setSupportsSpeechOutput] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"speech" | "recorder">("speech");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const manualStopRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const transcribeOnStopRef = useRef(false);
  const voiceBaseQuestionRef = useRef("");

  useEffect(() => {
    (async () => {
      setLoadingSubject(true);
      const response = await fetch(`/api/subjects/${subjectId}`);
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error || "Subject not found");
      } else {
        setSubjectName(payload.subject.name);
      }
      setLoadingSubject(false);
    })();
  }, [subjectId]);

  useEffect(() => {
    const recognitionSupported =
      typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    const recorderSupported = typeof window !== "undefined" && Boolean(window.MediaRecorder);
    const outputSupported = typeof window !== "undefined" && Boolean(window.speechSynthesis);

    setSupportsSpeechInput(recognitionSupported || recorderSupported);
    setSupportsMediaRecorder(recorderSupported);
    setSupportsSpeechOutput(outputSupported);
    if (!recognitionSupported && recorderSupported) {
      setVoiceMode("recorder");
    }

    if (typeof window !== "undefined") {
      const storedAutoSpeak = localStorage.getItem(AUTO_SPEAK_KEY);
      setAutoSpeak(storedAutoSpeak === "1");
    }

    return () => {
      manualStopRef.current = true;
      transcribeOnStopRef.current = false;
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function speak(text: string) {
    if (!supportsSpeechOutput || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  function toggleAutoSpeak() {
    const next = !autoSpeak;
    setAutoSpeak(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTO_SPEAK_KEY, next ? "1" : "0");
    }
    toast.success(next ? "Voice answers enabled" : "Voice answers disabled");
  }

  async function checkMicrophoneAccess() {
    if (typeof navigator === "undefined") return true;

    if ("permissions" in navigator && navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (permission.state === "denied") {
          toast.error("Microphone permission is blocked. Allow access and retry.");
          return false;
        }
      } catch {
        // Ignore permissions API failures and continue.
      }
    }
    return true;
  }

  function clearRecorderRefs() {
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  async function transcribeRecordedAudio(blob: Blob) {
    if (blob.size === 0) {
      toast.error("No audio captured. Please try again.");
      return;
    }

    const extension = blob.type.includes("mp4")
      ? "m4a"
      : blob.type.includes("ogg")
        ? "ogg"
        : blob.type.includes("mpeg")
          ? "mp3"
          : blob.type.includes("wav")
            ? "wav"
            : "webm";

    const form = new FormData();
    form.set("audio", new File([blob], `voice-input.${extension}`, { type: blob.type || "audio/webm" }));

    setIsTranscribing(true);

    try {
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };

      if (!response.ok) {
        toast.error(payload.error || "Voice transcription failed.");
        return;
      }

      const transcript = payload.text?.trim() ?? "";
      const normalizedTranscript = normalizeVoiceTranscript(transcript);
      if (!normalizedTranscript) {
        toast.error("No speech detected in recording.");
        return;
      }

      setQuestion((previous) => cleanText(previous ? `${previous} ${normalizedTranscript}` : normalizedTranscript));
      toast.success("Voice input captured.");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function beginRecorderMode() {
    if (typeof window === "undefined" || !window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Audio recorder is not available in this browser.");
      return;
    }

    const micAllowed = await checkMicrophoneAccess();
    if (!micAllowed) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) {
      toast.error("Unable to access microphone for recording.");
      return;
    }

    const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    const mimeType =
      preferredTypes.find((type) => {
        try {
          return window.MediaRecorder?.isTypeSupported(type);
        } catch {
          return false;
        }
      }) || "";

    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      toast.error("Failed to initialize audio recorder.");
      return;
    }

    mediaRecorderRef.current = recorder;
    mediaStreamRef.current = stream;
    mediaChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        mediaChunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      toast.error("Recording failed. Please try again.");
      setIsRecording(false);
      clearRecorderRefs();
    };

    recorder.onstop = () => {
      const shouldTranscribe = transcribeOnStopRef.current;
      transcribeOnStopRef.current = false;
      const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setIsRecording(false);
      clearRecorderRefs();
      if (shouldTranscribe) {
        void transcribeRecordedAudio(blob);
      }
    };

    recorder.start();
    setIsRecording(true);
    toast.success("Recording started. Tap again to stop and transcribe.");
  }

  function stopRecorderModeAndTranscribe() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }
    transcribeOnStopRef.current = true;
    recorder.stop();
  }

  async function startListening() {
    if (!supportsSpeechInput || sending || isTranscribing) {
      toast.error("Speech input is not available in this browser");
      return;
    }

    if (voiceMode === "recorder") {
      if (isRecording) {
        stopRecorderModeAndTranscribe();
      } else {
        await beginRecorderMode();
      }
      return;
    }

    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error("Voice input needs a secure context. Use localhost or HTTPS.");
      return;
    }

    const micAllowed = await checkMicrophoneAccess();
    if (!micAllowed) {
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Speech input is not available in this browser");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    manualStopRef.current = false;
    voiceBaseQuestionRef.current = question.trim();

    recognition.onresult = (event) => {
      const transcriptParts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const part = normalizeVoiceTranscript(event.results[i]?.[0]?.transcript?.trim() ?? "");
        if (!part) continue;
        transcriptParts.push(part);
      }

      const recognized = normalizeVoiceTranscript(transcriptParts.join(" "));
      if (!recognized) return;

      const base = voiceBaseQuestionRef.current;
      setQuestion(cleanText(base ? `${base} ${recognized}` : recognized));
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" && manualStopRef.current) {
        return;
      }

      if (event.error === "network" && supportsMediaRecorder) {
        setVoiceMode("recorder");
        setIsListening(false);
        toast.error("Browser speech service is unavailable. Switched to recorder mode.");
        return;
      }

      toast.error(recognitionErrorMessage(event.error));
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      manualStopRef.current = false;
      voiceBaseQuestionRef.current = "";
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      toast.error("Failed to start microphone capture. Please retry.");
      setIsListening(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    const history: ChatTurn[] = messages.slice(-8).map((message) => ({
      role: message.role,
      text: message.text,
    }));

    setSending(true);
    setQuestion("");

    setMessages((previous) => [...previous, { role: "user", text: trimmed }]);

    try {
      const response = await fetch(`/api/subjects/${subjectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const payload = (await response.json()) as ChatResponsePayload & { error?: string };

      if (!response.ok) {
        toast.error(payload.error || "Chat request failed");
        return;
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: payload.answer,
          payload,
        },
      ]);

      if (autoSpeak) {
        speak(payload.answer);
      }
    } finally {
      setSending(false);
    }
  }

  const hasMessages = useMemo(() => messages.length > 0, [messages]);
  const voiceButtonLabel =
    voiceMode === "recorder"
      ? isRecording
        ? "Stop & Transcribe"
        : isTranscribing
          ? "Transcribing..."
          : "Record Voice"
      : isListening
        ? "Stop Listening"
        : "Voice Input";

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
          <Link href={`/app/subjects/${subjectId}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Chat {loadingSubject ? <Skeleton className="ml-2 inline-block h-7 w-36 align-middle" /> : subjectName}
        </h1>
        <p className="text-sm text-zinc-600">
          Subject-scoped teacher-style chat with multi-turn context. Voice ask and voice answers supported.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
          <CardDescription>
            Every answer remains evidence-grounded with citations, confidence, and strict Not Found behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasMessages ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600">
              Ask your first question about this subject.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <motion.div
                  key={`${message.role}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium text-zinc-700">
                    <div className="flex items-center gap-2">
                      {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      {message.role === "user" ? "You" : "AskMyNotes"}
                    </div>
                    {message.role === "assistant" && supportsSpeechOutput && (
                      <Button size="sm" variant="ghost" onClick={() => speak(message.text)}>
                        <Volume2 className="h-4 w-4" /> Speak
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-zinc-800">{message.text}</p>

                  {message.payload && (
                    <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs">
                      <Badge
                        variant={
                          message.payload.confidence === "High"
                            ? "success"
                            : message.payload.confidence === "Medium"
                              ? "warning"
                              : "danger"
                        }
                      >
                        Confidence: {message.payload.confidence}
                      </Badge>

                      <div>
                        <p className="font-semibold text-zinc-700">Citations</p>
                        {message.payload.citations.length === 0 ? (
                          <p className="text-zinc-500">No citations (Not Found)</p>
                        ) : (
                          <ul className="list-disc space-y-1 pl-4 text-zinc-600">
                            {message.payload.citations.map((citation) => (
                              <li key={`${citation.chunkId}-${citation.fileName}`}>
                                {citation.fileName} • {citation.pageOrSection} • {citation.chunkId}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <p className="font-semibold text-zinc-700">Top evidence</p>
                        {message.payload.evidence.length === 0 ? (
                          <p className="text-zinc-500">No evidence (Not Found)</p>
                        ) : (
                          <ul className="space-y-1 text-zinc-600">
                            {message.payload.evidence.map((item, idx) => (
                              <li key={`${item.fileName}-${idx}`} className="rounded-md bg-zinc-100 p-2">
                                <span className="font-medium">
                                  {item.fileName} ({item.pageOrSection}):
                                </span>{" "}
                                {item.textSnippet}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            <Textarea
              placeholder="Ask a question from this subject's notes..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={sending || !question.trim()}>
                <Send className="h-4 w-4" />
                {sending ? "Thinking..." : "Ask"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => void startListening()}
                disabled={!supportsSpeechInput || sending || isTranscribing}
                title={supportsSpeechInput ? "Ask by voice" : "Speech input unavailable"}
              >
                {isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : voiceMode === "recorder" ? (
                  isRecording ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )
                ) : isListening ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {voiceButtonLabel}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={toggleAutoSpeak}
                disabled={!supportsSpeechOutput}
                title={supportsSpeechOutput ? "Toggle voice answers" : "Speech output unavailable"}
              >
                {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {autoSpeak ? "Voice Reply On" : "Voice Reply Off"}
              </Button>
            </div>
            {voiceMode === "recorder" && (
              <p className="text-xs text-zinc-500">
                Recorder mode is active. It uploads your recorded audio for server transcription.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
