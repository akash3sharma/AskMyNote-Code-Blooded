import { describe, expect, it } from "vitest";

import { parseYoutubeVideoId, transcriptToSections } from "@/lib/youtube";

describe("parseYoutubeVideoId", () => {
  it("parses standard and short YouTube URLs", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYoutubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-YouTube URLs", () => {
    expect(parseYoutubeVideoId("https://example.com/video")).toBeNull();
    expect(parseYoutubeVideoId("")).toBeNull();
  });
});

describe("transcriptToSections", () => {
  it("groups transcript entries into timestamped sections", () => {
    const sections = transcriptToSections(
      [
        { text: "Learning is acquiring knowledge.", offset: 0, duration: 3 },
        { text: "Unlearning removes outdated beliefs.", offset: 4, duration: 4 },
        { text: "Practice improves retention over time.", offset: 9, duration: 4 },
      ],
      45,
    );

    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].pageOrSection.startsWith("Time")).toBe(true);
    expect(sections[0].text.length).toBeGreaterThan(10);
  });
});
