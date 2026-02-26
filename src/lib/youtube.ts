import { YoutubeTranscript } from "youtube-transcript";

import { cleanText } from "@/lib/utils";
import type { ParsedSection } from "@/lib/types";

type TranscriptEntry = {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
};

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

export function parseYoutubeVideoId(input: string) {
  const value = input.trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;

    if (host.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    const byQuery = url.searchParams.get("v");
    if (byQuery && /^[a-zA-Z0-9_-]{11}$/.test(byQuery)) {
      return byQuery;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const embedded = pathParts.find((part, index) => (part === "embed" || part === "shorts") && pathParts[index + 1]);
    if (embedded) {
      const idx = pathParts.indexOf(embedded);
      const id = pathParts[idx + 1];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

function formatTime(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function transcriptToSections(entries: TranscriptEntry[], targetChars = 1200): ParsedSection[] {
  const cleanedEntries = entries
    .map((entry) => ({
      ...entry,
      text: cleanText(decodeHtmlEntities(entry.text || "")),
    }))
    .filter((entry) => entry.text.length > 0);

  if (cleanedEntries.length === 0) {
    return [];
  }

  const sections: ParsedSection[] = [];

  let bucketText = "";
  let bucketStart = cleanedEntries[0].offset;
  let bucketEnd = cleanedEntries[0].offset;

  function flushBucket() {
    const normalized = cleanText(bucketText);
    if (!normalized) return;

    sections.push({
      pageOrSection: `Time ${formatTime(bucketStart)}-${formatTime(bucketEnd)}`,
      text: normalized,
    });
    bucketText = "";
  }

  for (const entry of cleanedEntries) {
    const snippet = entry.text;
    const snippetEnd = entry.offset + Math.max(0.5, entry.duration || 0);
    if (!bucketText) {
      bucketStart = entry.offset;
      bucketEnd = snippetEnd;
      bucketText = snippet;
      continue;
    }

    const nextText = `${bucketText} ${snippet}`.trim();
    const shouldSplit = nextText.length >= targetChars && /[.!?]$/.test(bucketText);

    if (shouldSplit) {
      flushBucket();
      bucketStart = entry.offset;
      bucketEnd = snippetEnd;
      bucketText = snippet;
      continue;
    }

    bucketText = nextText;
    bucketEnd = snippetEnd;
  }

  flushBucket();
  return sections;
}

async function resolveYoutubeTitle(videoId: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  const response = await fetch(oembed).catch(() => null);
  if (!response?.ok) {
    return `YouTube-${videoId}`;
  }

  const payload = (await response.json().catch(() => null)) as { title?: string } | null;
  const title = payload?.title?.trim();
  return title ? title : `YouTube-${videoId}`;
}

async function fetchTranscriptEntries(url: string) {
  let transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "en" }).catch(() => []);
  if (transcript.length === 0) {
    transcript = await YoutubeTranscript.fetchTranscript(url).catch(() => []);
  }
  return transcript as TranscriptEntry[];
}

export async function fetchYoutubeTranscriptAsSections(input: string) {
  const videoId = parseYoutubeVideoId(input);
  if (!videoId) {
    throw new Error("Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.");
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const transcriptEntries = await fetchTranscriptEntries(watchUrl);

  if (transcriptEntries.length === 0) {
    throw new Error("No transcript found for this YouTube video. Try another video with captions enabled.");
  }

  const sections = transcriptToSections(transcriptEntries);
  if (sections.length === 0) {
    throw new Error("Could not extract usable text from this video transcript.");
  }

  const title = await resolveYoutubeTitle(videoId);
  const totalChars = sections.reduce((sum, section) => sum + section.text.length, 0);

  return {
    videoId,
    title,
    sections,
    totalChars,
  };
}
