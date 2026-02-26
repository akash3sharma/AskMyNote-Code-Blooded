import { describe, expect, it } from "vitest";

import { resolveEffectiveQuestion } from "@/lib/chat";

describe("resolveEffectiveQuestion", () => {
  it("keeps standalone question unchanged when history is absent", async () => {
    const question = "What is recursion?";
    const effective = await resolveEffectiveQuestion({ question, history: [] });

    expect(effective).toBe(question);
  });

  it("expands follow-up question using recent conversation context", async () => {
    const effective = await resolveEffectiveQuestion({
      question: "give an example",
      history: [
        { role: "user", text: "What is a stack in DSA?" },
        { role: "assistant", text: "A stack follows LIFO order with push and pop operations." },
      ],
    });

    expect(effective.toLowerCase()).toContain("example");
    expect(/stack|lifo|push|pop/i.test(effective)).toBe(true);
  });
});
