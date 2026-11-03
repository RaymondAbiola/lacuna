import { describe, expect, it } from "vitest";
import { splitClauses } from "../src/clause.js";

describe("splitClauses", () => {
  it("splits a paragraph into sentences", () => {
    const c = splitClauses("Pay invoices under $500. Escalate anything larger.");
    expect(c.map((x) => x.text)).toEqual([
      "Pay invoices under $500.",
      "Escalate anything larger.",
    ]);
    expect(c.every((x) => x.form === "sentence")).toBe(true);
  });

  it("does not split decimals", () => {
    // A policy full of "$5.00" would otherwise shatter into noise.
    const c = splitClauses("Never spend more than $12.50 per call.");
    expect(c).toHaveLength(1);
    expect(c[0]?.text).toBe("Never spend more than $12.50 per call.");
  });

  it("does not split common abbreviations", () => {
    const c = splitClauses("Approve routine items, e.g. hosting and domains. Flag the rest.");
    expect(c).toHaveLength(2);
    expect(c[0]?.text).toContain("e.g. hosting");
  });

  it("keeps a list item whole and marks its form", () => {
    const c = splitClauses("- Never pay the same invoice twice. Not even once.\n- Cap at $500.");
    expect(c).toHaveLength(2);
    expect(c[0]?.form).toBe("list_item");
    // The sentence split must not run inside a list item.
    expect(c[0]?.text).toContain("Not even once.");
  });

  it("recognises numbered and lettered markers", () => {
    const c = splitClauses("1. First rule.\n2) Second rule.\na. Third rule.");
    expect(c).toHaveLength(3);
    expect(c.every((x) => x.form === "list_item")).toBe(true);
  });

  it("assigns stable contiguous indices", () => {
    const c = splitClauses("One. Two.\n- Three\nFour.");
    expect(c.map((x) => x.index)).toEqual([0, 1, 2, 3]);
  });

  it("is deterministic across runs, so findings compare across runs", () => {
    const text = "Pay under $500.\n- Escalate above that.\nNever pay twice.";
    expect(splitClauses(text)).toEqual(splitClauses(text));
  });

  it("drops blank lines and surrounding whitespace", () => {
    const c = splitClauses("\n\n   Pay invoices.   \n\n\n   Escalate refunds.  \n");
    expect(c.map((x) => x.text)).toEqual(["Pay invoices.", "Escalate refunds."]);
  });

  it("handles a single clause with no terminator", () => {
    const c = splitClauses("Spend up to ten dollars on lunch");
    expect(c).toHaveLength(1);
    expect(c[0]?.form).toBe("sentence");
  });
});
