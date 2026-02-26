import { describe, expect, it } from "vitest";

import { chunkSections, chunkText } from "@/lib/chunking";

describe("chunkText", () => {
  it("splits long text into multiple overlapping chunks", () => {
    const text = Array.from({ length: 240 }, (_, index) => `term${index}`).join(" ");
    const chunks = chunkText(text, { maxChars: 120, overlapChars: 20, minChars: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(120);
    expect(chunks[1].length).toBeLessThanOrEqual(120);

    const firstTail = chunks[0].slice(-20).split(" ")[0];
    expect(chunks[1]).toContain(firstTail);
  });

  it("keeps short text as a single chunk", () => {
    const chunks = chunkText("This is a compact note section.");
    expect(chunks).toHaveLength(1);
  });
});

describe("chunkSections", () => {
  it("preserves page metadata while chunking", () => {
    const result = chunkSections([
      { pageOrSection: "Page 2", text: "A ".repeat(500) },
      { pageOrSection: "Page 3", text: "B ".repeat(500) },
    ]);

    expect(result.length).toBeGreaterThan(2);
    expect(result.some((item) => item.pageOrSection === "Page 2")).toBe(true);
    expect(result.some((item) => item.pageOrSection === "Page 3")).toBe(true);
  });
});
