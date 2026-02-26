import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(text: string, length = 180) {
  if (text.length <= length) return text;
  return `${text.slice(0, length - 3)}...`;
}

export function cleanText(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

export function sentenceSplit(input: string) {
  return input
    .split(/(?<=[.!?])\s+/)
    .map((line) => cleanText(line))
    .filter(Boolean);
}

export function tokenize(input: string) {
  return cleanText(input)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

export function toObjectIdString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toString" in value) {
    return (value as { toString: () => string }).toString();
  }
  return "";
}

function normalizeTokenForMatch(token: string) {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function collapseImmediateNgramRepeat(tokens: string[], n: number) {
  if (tokens.length < n * 2) return tokens;

  const output = [...tokens];
  let changed = true;

  while (changed) {
    changed = false;
    for (let i = n; i + n <= output.length; i += 1) {
      const previous = output.slice(i - n, i).map(normalizeTokenForMatch).join("|");
      const current = output.slice(i, i + n).map(normalizeTokenForMatch).join("|");
      if (previous && previous === current) {
        output.splice(i, n);
        changed = true;
        break;
      }
    }
  }

  return output;
}

export function normalizeVoiceTranscript(input: string) {
  const cleaned = cleanText(input);
  if (!cleaned) return "";

  const words = cleaned.split(" ").filter(Boolean);
  const deduped: string[] = [];

  for (const word of words) {
    const normalized = normalizeTokenForMatch(word);
    const previous = deduped[deduped.length - 1];
    const previousNormalized = previous ? normalizeTokenForMatch(previous) : "";
    if (normalized && previousNormalized === normalized) {
      continue;
    }
    deduped.push(word);
  }

  const withoutRepeatedBigrams = collapseImmediateNgramRepeat(deduped, 2);
  return cleanText(withoutRepeatedBigrams.join(" "));
}
