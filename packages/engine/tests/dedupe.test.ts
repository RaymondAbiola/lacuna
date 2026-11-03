import { describe, expect, it } from "vitest";
import { dedupeCases, reindex, signature } from "../src/dedupe.js";
import type { AttackCase } from "@lacuna/core";

const mk = (over: Partial<AttackCase>): AttackCase => ({
  id: "x",
  kind: "logical",
  family: "loophole",
  scenario: "a scenario",
  request: "a request",
  expectedByIntent: "deny",
  probes: ["i0"],
  rationale: "because",
  ...over,
});

describe("signature", () => {
  it("ignores case, punctuation and filler words", () => {
    const a = mk({ scenario: "Two invoices, for $9.50, from the same supplier." });
    const b = mk({ scenario: "two invoices for $9 50 from same supplier" });
    expect(signature(a)).toBe(signature(b));
  });

  it("separates cases in different families", () => {
    // The same scenario probed as a loophole and as a silence are different
    // findings and must both survive.
    expect(signature(mk({ family: "loophole" }))).not.toBe(signature(mk({ family: "silence" })));
  });

  it("separates genuinely different requests", () => {
    expect(signature(mk({ request: "pay invoice 12" }))).not.toBe(
      signature(mk({ request: "pay invoice 99" })),
    );
  });

  it("is stable across calls", () => {
    const c = mk({});
    expect(signature(c)).toBe(signature(c));
  });
});

describe("dedupeCases", () => {
  it("keeps the first of a duplicate pair", () => {
    const kept = dedupeCases([
      mk({ id: "a", rationale: "first" }),
      mk({ id: "b", rationale: "second" }),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.rationale).toBe("first");
  });

  it("keeps distinct cases", () => {
    const kept = dedupeCases([
      mk({ id: "a", request: "pay 12" }),
      mk({ id: "b", request: "pay 99" }),
      mk({ id: "c", family: "composition", request: "pay 12" }),
    ]);
    expect(kept).toHaveLength(3);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeCases([])).toEqual([]);
  });
});

describe("reindex", () => {
  it("makes ids contiguous after filtering", () => {
    const out = reindex([mk({ id: "L-7" }), mk({ id: "L-2", request: "other" })], "L");
    expect(out.map((c) => c.id)).toEqual(["L-0", "L-1"]);
  });

  it("leaves everything but the id alone", () => {
    const input = mk({ id: "zzz", rationale: "keep me" });
    expect(reindex([input], "L")[0]?.rationale).toBe("keep me");
  });
});
