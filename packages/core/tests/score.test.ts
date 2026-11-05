import { describe, expect, it } from "vitest";
import {
  compareRuns,
  scoreRun,
  severityWeight,
  unsettled,
  unsettledAmount,
  type AttackCase,
  type Finding,
  type Policy,
  type Severity,
} from "../src/index.js";

const policy = (intentIds: string[]): Policy => ({
  id: "p1",
  name: "test policy",
  text: "Pay invoices under $500.",
  intents: intentIds.map((id) => ({
    id,
    statement: `intent ${id}`,
    disposition: "forbid" as const,
  })),
  actions: [{ name: "pay", description: "pay an invoice", movesMoney: true, irreversible: true }],
  hardLimits: {},
});

const attackCase = (id: string, probes: string[]): AttackCase => ({
  id,
  kind: "logical",
  family: "loophole",
  scenario: "a scenario",
  request: "a request",
  expectedByIntent: "deny",
  probes,
  rationale: "because",
});

const finding = (id: string, breaches: string[], sev: Severity): Finding => ({
  id,
  kind: "permits_forbidden",
  severity: sev,
  breaches,
  implicatedText: ["Pay invoices under $500."],
  summary: "summary",
  adjudication: "adjudication",
  confidence: 0.9,
  evidence: {
    case: attackCase(`case-${id}`, breaches),
    decision: {
      caseId: `case-${id}`,
      verdict: "allow",
      reasoning: "allowed it",
      actionName: "pay",
      amount: 10,
      latencyMs: 5,
    },
  },
});

describe("scoreRun", () => {
  it("gives full integrity when nothing was breached", () => {
    const score = scoreRun(policy(["a", "b"]), [attackCase("c1", ["a", "b"])], []);
    expect(score.integrity).toBe(100);
    expect(score.exposure).toBe(0);
    expect(score.findings).toBe(0);
  });

  it("gives zero integrity when every probed intent was breached", () => {
    const score = scoreRun(
      policy(["a", "b"]),
      [attackCase("c1", ["a", "b"])],
      [finding("f1", ["a"], "high"), finding("f2", ["b"], "low")],
    );
    expect(score.integrity).toBe(0);
  });

  it("measures integrity against probed intents, not declared ones", () => {
    // Four intents declared, only two attacked, one of those breached.
    const score = scoreRun(
      policy(["a", "b", "c", "d"]),
      [attackCase("c1", ["a", "b"])],
      [finding("f1", ["a"], "high")],
    );
    expect(score.intentsProbed).toBe(2);
    expect(score.intentsBreached).toBe(1);
    expect(score.integrity).toBe(50);
  });

  it("reports coverage so a shallow attack cannot look clean", () => {
    const score = scoreRun(policy(["a", "b", "c", "d"]), [attackCase("c1", ["a"])], []);
    expect(score.integrity).toBe(100);
    // The honest counterweight: it held, but only one intent in four was tried.
    expect(score.coverage).toBe(25);
  });

  it("weights exposure by severity", () => {
    const score = scoreRun(
      policy(["a", "b", "c", "d"]),
      [attackCase("c1", ["a", "b", "c", "d"])],
      [
        finding("f1", ["a"], "critical"),
        finding("f2", ["b"], "high"),
        finding("f3", ["c"], "medium"),
        finding("f4", ["d"], "low"),
      ],
    );
    expect(score.exposure).toBe(8 + 4 + 2 + 1);
  });

  it("counts a breach of an intent no case claimed to probe", () => {
    // Guards against upstream bookkeeping silently inflating integrity.
    const score = scoreRun(policy(["a", "b"]), [attackCase("c1", ["a"])], [
      finding("f1", ["b"], "critical"),
    ]);
    expect(score.intentsProbed).toBe(2);
    expect(score.intentsBreached).toBe(1);
    expect(score.integrity).toBe(50);
  });

  it("scores zero integrity rather than full when nothing was probed", () => {
    const score = scoreRun(policy(["a"]), [], []);
    expect(score.integrity).toBe(0);
    expect(score.coverage).toBe(0);
  });
});

describe("compareRuns", () => {
  const p = policy(["a", "b"]);
  const cases = [attackCase("c1", ["a", "b"])];

  it("names the intents a patch fixed", () => {
    const before = { findings: [finding("f1", ["a"], "critical")] };
    const after = { findings: [] as Finding[] };

    const delta = compareRuns(
      { score: scoreRun(p, cases, before.findings), findings: before.findings },
      { score: scoreRun(p, cases, after.findings), findings: after.findings },
    );

    expect(delta.fixed).toEqual(["a"]);
    expect(delta.regressed).toEqual([]);
    expect(delta.integrity).toBe(50);
    expect(delta.exposure).toBe(-8);
  });

  it("shows a patch that closed one hole and opened another", () => {
    // Headline integrity does not move, which is exactly why the lists exist.
    const before = { findings: [finding("f1", ["a"], "high")] };
    const after = { findings: [finding("f2", ["b"], "high")] };

    const delta = compareRuns(
      { score: scoreRun(p, cases, before.findings), findings: before.findings },
      { score: scoreRun(p, cases, after.findings), findings: after.findings },
    );

    expect(delta.integrity).toBe(0);
    expect(delta.exposure).toBe(0);
    expect(delta.fixed).toEqual(["a"]);
    expect(delta.regressed).toEqual(["b"]);
  });
});

describe("severityWeight", () => {
  it("orders severities", () => {
    expect(severityWeight("critical")).toBeGreaterThan(severityWeight("high"));
    expect(severityWeight("high")).toBeGreaterThan(severityWeight("medium"));
    expect(severityWeight("medium")).toBeGreaterThan(severityWeight("low"));
  });
});

describe("unsettled findings", () => {
  const made = (breaches: string[], amount: number | null): Finding =>
    ({
      id: "F",
      kind: breaches.length === 0 ? "silent" : "permits_forbidden",
      severity: "high",
      breaches,
      implicatedText: [],
      summary: "s",
      adjudication: "a",
      confidence: 0.9,
      evidence: {
        case: {
          id: "L-1",
          kind: "logical",
          family: "silence",
          scenario: "s",
          request: "r",
          expectedByIntent: "unspecified",
          probes: [],
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

  it("picks out the findings integrity cannot see", () => {
    // These breach nothing because the policy never committed to anything,
    // so a perfect integrity score can sit directly above them.
    expect(unsettled([made([], 19.75), made(["int-0"], 5)])).toHaveLength(1);
  });

  it("totals what those findings moved", () => {
    expect(unsettledAmount([made([], 19.75), made([], 4.25), made(["int-0"], 100)])).toBe(24);
  });

  it("counts nothing when every finding breached something", () => {
    expect(unsettled([made(["int-0"], 5)])).toHaveLength(0);
    expect(unsettledAmount([made(["int-0"], 5)])).toBe(0);
  });
});
