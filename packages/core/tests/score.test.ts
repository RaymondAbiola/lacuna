import { describe, expect, it } from "vitest";
import {
  compareRuns,
  scoreRun,
  severityWeight,
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
