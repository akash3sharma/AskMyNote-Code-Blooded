import { describe, expect, it } from "vitest";

import { normalizeVoiceTranscript } from "@/lib/utils";

describe("normalizeVoiceTranscript", () => {
  it("collapses repeated single-word stutters", () => {
    const output = normalizeVoiceTranscript("what what what is is is sorting");
    expect(output).toBe("what is sorting");
  });

  it("collapses immediate repeated bigrams", () => {
    const output = normalizeVoiceTranscript("what is what is quick sort");
    expect(output).toBe("what is quick sort");
  });

  it("keeps normal sentence structure", () => {
    const output = normalizeVoiceTranscript("Explain merge sort with one example.");
    expect(output).toBe("Explain merge sort with one example.");
  });
});

