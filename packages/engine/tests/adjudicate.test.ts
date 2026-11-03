import { describe, expect, it } from "vitest";
import { quotesFoundIn } from "../src/adjudicate.js";

const policy = `Never spend more than $20 in any rolling 7 days.
Only top up when the balance drops to 10 chops or below.`;

describe("quotesFoundIn", () => {
  it("keeps a quote that appears verbatim", () => {
    expect(quotesFoundIn(policy, ["Never spend more than $20 in any rolling 7 days."])).toHaveLength(1);
  });

  it("keeps a quote that differs only in whitespace", () => {
    // Line wrapping in a model's output must not discard a real quote.
    expect(quotesFoundIn(policy, ["Never spend more than $20\n  in any rolling 7 days."])).toHaveLength(1);
  });

  it("is case insensitive", () => {
    expect(quotesFoundIn(policy, ["only top up when the balance drops"])).toHaveLength(1);
  });

  it("drops a fabricated quote", () => {
    // A quote the author cannot find in their own policy is worse than none.
    expect(quotesFoundIn(policy, ["Never spend more than $50 per week."])).toHaveLength(0);
  });

  it("drops a paraphrase", () => {
    expect(quotesFoundIn(policy, ["the weekly cap is twenty dollars"])).toHaveLength(0);
  });

  it("keeps the real quotes and drops the invented ones together", () => {
    const kept = quotesFoundIn(policy, [
      "Only top up when the balance drops to 10 chops or below.",
      "Always notify the owner by email.",
    ]);
    expect(kept).toEqual(["Only top up when the balance drops to 10 chops or below."]);
  });

  it("ignores empty and whitespace-only quotes", () => {
    expect(quotesFoundIn(policy, ["", "   ", "\n"])).toHaveLength(0);
  });
});
