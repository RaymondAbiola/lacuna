import { describe, expect, it } from "vitest";
import { containment, summariseContainment } from "../src/containment.js";
import type { Finding } from "../src/finding.js";

const LIMITS = { kite_per_transaction: 5, kite_per_session: 25 };

const finding = (amount: number | null, family = "loophole"): Finding =>
  ({
    id: "F-1",
    kind: "silent",
    severity: "high",
    breaches: ["int-0"],
    implicatedText: [],
    summary: "s",
    adjudication: "a",
    confidence: 0.9,
    evidence: {
      case: {
        id: "L-1",
        kind: "logical",
        family,
        scenario: "s",
        request: "r",
        expectedByIntent: "deny",
        probes: ["int-0"],
        rationale: "r",
      },
      decision: {
        caseId: "L-1",
        verdict: "allow",
        reasoning: "ok",
        actionName: "pay",
        amount,
        latencyMs: 1,
      },
    },
  }) as Finding;

describe("containment", () => {
  it("calls a finding over the per-payment cap stopped", () => {
    expect(containment(finding(30), LIMITS)).toBe("stopped");
  });

  it("calls a finding under the cap live, because nothing catches it", () => {
    expect(containment(finding(4.5), LIMITS)).toBe("live");
  });

  it("treats a finding exactly at the cap as live", () => {
    // The cap refuses what exceeds it, not what equals it.
    expect(containment(finding(5), LIMITS)).toBe("live");
  });

  it("will not call a splittable attack stopped by a per-payment cap", () => {
    // Four payments of $4 defeat a $5 per-transaction limit without ever
    // exceeding it. Splitting is the attack, so only the total can hold it.
    expect(containment(finding(20, "composition"), LIMITS)).toBe("live");
    expect(containment(finding(20, "incremental"), LIMITS)).toBe("live");
  });

  it("contains a splittable attack once it passes the session total", () => {
    expect(containment(finding(40, "composition"), LIMITS)).toBe("stopped");
  });

  it("says unknown when the agent never named an amount", () => {
    expect(containment(finding(null), LIMITS)).toBe("unknown");
  });

  it("says unknown when there are no hard limits to judge against", () => {
    // An agent with no session is not an agent with no risk.
    expect(containment(finding(30), {})).toBe("unknown");
  });
});

describe("summariseContainment", () => {
  it("counts each kind and totals only what nothing stopped", () => {
    const out = summariseContainment(
      [finding(30), finding(4), finding(1.5), finding(null)],
      LIMITS,
    );
    expect(out).toEqual({ stopped: 1, live: 2, unknown: 1, liveAmount: 5.5 });
  });

  it("reports nothing contained when there are no limits", () => {
    const out = summariseContainment([finding(30), finding(4)], {});
    expect(out).toEqual({ stopped: 0, live: 0, unknown: 2, liveAmount: 0 });
  });
});
