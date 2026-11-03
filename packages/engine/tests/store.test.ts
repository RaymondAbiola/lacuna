import { describe, expect, it } from "vitest";
import type { AttackCase, CompiledPolicy, Decision, Finding } from "@lacuna/core";
import { scoreRun } from "@lacuna/core";
import { cachedCompile, openStore, policyHash, previousRun, putCompiled, saveRun } from "../src/store.js";

const policy: CompiledPolicy = {
  text: "Never spend more than $20 in any rolling 7 days.",
  clauses: [{ index: 0, text: "Never spend more than $20 in any rolling 7 days.", form: "sentence" }],
  intents: [
    { id: "i0", statement: "never exceeds $20 weekly", disposition: "forbid", sourceClauses: [0], confidence: 1, confirmed: false },
  ],
  actions: [{ name: "pay", description: "pay", movesMoney: true, irreversible: true }],
  undefinedTerms: [],
  openQuestions: [],
};

const attackCase: AttackCase = {
  id: "L-0",
  kind: "logical",
  family: "loophole",
  scenario: "s",
  request: "r",
  expectedByIntent: "deny",
  probes: ["i0"],
  rationale: "why",
};

const decision: Decision = {
  caseId: "L-0",
  verdict: "allow",
  reasoning: "allowed",
  actionName: "pay",
  amount: 12,
  latencyMs: 10,
};

const finding: Finding = {
  id: "F-L-0",
  kind: "permits_forbidden",
  severity: "critical",
  breaches: ["i0"],
  implicatedText: ["Never spend more than $20 in any rolling 7 days."],
  summary: "allowed a payment over the weekly cap",
  adjudication: "the words permit it",
  confidence: 0.95,
  evidence: { case: attackCase, decision },
};

const fresh = () => openStore(":memory:");

const asPolicy = { id: "p", name: "p", text: policy.text, intents: policy.intents, actions: policy.actions, hardLimits: {} };

describe("policyHash", () => {
  it("ignores whitespace, so a reflowed policy still hits the cache", () => {
    expect(policyHash("Pay under $500.   Escalate\nthe rest.")).toBe(
      policyHash("Pay under $500. Escalate the rest."),
    );
  });

  it("separates genuinely different policies", () => {
    expect(policyHash("Pay under $500.")).not.toBe(policyHash("Pay under $900."));
  });
});

describe("compile cache", () => {
  it("returns nothing before anything is stored", () => {
    expect(cachedCompile(fresh(), policy.text)).toBeUndefined();
  });

  it("round-trips a compiled policy", () => {
    const db = fresh();
    putCompiled(db, policy);
    const back = cachedCompile(db, policy.text);
    expect(back?.intents[0]?.id).toBe("i0");
    expect(back?.clauses).toHaveLength(1);
  });

  it("overwrites rather than duplicating on recompile", () => {
    const db = fresh();
    putCompiled(db, policy);
    putCompiled(db, { ...policy, openQuestions: ["new question"] });
    expect(cachedCompile(db, policy.text)?.openQuestions).toEqual(["new question"]);
  });
});

describe("previousRun", () => {
  it("returns nothing for a policy never run", () => {
    expect(previousRun(fresh(), policy.text)).toBeUndefined();
  });

  it("preserves the case set so a re-run can replay it", () => {
    // This is the point of the store. Measuring a patch against freshly
    // generated attacks compares two different experiments.
    const db = fresh();
    const score = scoreRun(asPolicy, [attackCase], [finding]);
    saveRun(db, {
      policy,
      target: { kind: "local", url: null, model: "m" },
      cases: [attackCase],
      decisions: [decision],
      findings: [finding],
      score,
      startedAt: new Date().toISOString(),
    });

    const prior = previousRun(db, policy.text);
    expect(prior?.cases).toHaveLength(1);
    expect(prior?.cases[0]?.id).toBe("L-0");
    expect(prior?.findings[0]?.severity).toBe("critical");
    expect(prior?.score.integrity).toBe(0);
  });

  it("returns the most recent run for that policy", () => {
    const db = fresh();
    const score = scoreRun(asPolicy, [attackCase], []);
    saveRun(db, {
      policy, target: { kind: "local", url: null, model: "m" },
      cases: [attackCase], decisions: [decision], findings: [], score,
      startedAt: "2026-01-01T00:00:00.000Z", label: "older",
    });
    saveRun(db, {
      policy, target: { kind: "local", url: null, model: "m" },
      cases: [{ ...attackCase, id: "L-9" }], decisions: [decision], findings: [], score,
      startedAt: "2026-06-01T00:00:00.000Z", label: "newer",
    });
    expect(previousRun(db, policy.text)?.cases[0]?.id).toBe("L-9");
  });

  it("does not return a run of a different policy", () => {
    const db = fresh();
    const score = scoreRun(asPolicy, [attackCase], []);
    saveRun(db, {
      policy, target: { kind: "local", url: null, model: "m" },
      cases: [attackCase], decisions: [decision], findings: [], score,
      startedAt: new Date().toISOString(),
    });
    expect(previousRun(db, "A completely different policy.")).toBeUndefined();
  });
});
