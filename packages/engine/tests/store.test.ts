import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type { AttackCase, CompiledPolicy, Decision, Finding } from "@lacuna/core";
import { scoreRun } from "@lacuna/core";
import {
  cachedCompile,
  listRuns,
  openStore,
  policyHash,
  previousRun,
  putCompiled,
  runById,
  saveRun,
} from "../src/store.js";

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

/*
 * Hard limits were added to the schema after stores had already been written
 * in the field. Opening one of those must migrate it in place rather than
 * throw, and must not disturb what is already in it.
 */
describe("migrating a store written before hard limits existed", () => {
  const oldSchema = (path: string) => {
    const db = new Database(path);
    db.exec(`
      CREATE TABLE policies (hash TEXT PRIMARY KEY, text TEXT NOT NULL, compiled TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE runs (
        id TEXT PRIMARY KEY, policy_hash TEXT NOT NULL, started_at TEXT NOT NULL,
        finished_at TEXT, target TEXT NOT NULL, cases TEXT NOT NULL,
        decisions TEXT NOT NULL, findings TEXT NOT NULL, score TEXT NOT NULL, label TEXT
      );
    `);
    db.prepare(
      `INSERT INTO runs (id, policy_hash, started_at, finished_at, target, cases, decisions, findings, score, label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "old-run",
      policyHash(policy.text),
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:01:00.000Z",
      JSON.stringify({ kind: "local", url: null, model: null }),
      JSON.stringify([attackCase]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify(scoreRun({ id: "p", name: "p", text: policy.text, intents: policy.intents, actions: policy.actions, hardLimits: {} }, [attackCase], [])),
      null,
    );
    db.close();
  };

  it("adds the column instead of throwing, and keeps the rows", () => {
    const path = join(tmpdir(), `lacuna-migrate-${randomUUID()}.sqlite`);
    oldSchema(path);

    const db = openStore(path);
    const runs = listRuns(db, 10);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe("old-run");
    expect(runs[0]?.cases).toHaveLength(1);
    db.close();
    rmSync(path, { force: true });
  });

  it("reports no hard limits for a run recorded before they were captured", () => {
    // Not a claim that the agent had none: it means this run never recorded
    // any, and containment on its findings will read "unknown".
    const path = join(tmpdir(), `lacuna-migrate-${randomUUID()}.sqlite`);
    oldSchema(path);

    const db = openStore(path);
    expect(listRuns(db, 10)[0]?.hardLimits).toEqual({});
    db.close();
    rmSync(path, { force: true });
  });

  it("stores and returns hard limits for a run that recorded them", () => {
    const path = join(tmpdir(), `lacuna-migrate-${randomUUID()}.sqlite`);
    const db = openStore(path);
    putCompiled(db, policy);
    saveRun(db, {
      policy,
      target: { kind: "http", url: "http://agent.local/decide", model: null },
      cases: [attackCase],
      decisions: [],
      findings: [],
      score: scoreRun({ id: "p", name: "p", text: policy.text, intents: policy.intents, actions: policy.actions, hardLimits: {} }, [attackCase], []),
      startedAt: "2026-01-01T00:00:00.000Z",
      hardLimits: { kite_per_transaction: 50, kite_per_session: 250 },
    });

    expect(listRuns(db, 10)[0]?.hardLimits).toEqual({
      kite_per_transaction: 50,
      kite_per_session: 250,
    });
    db.close();
    rmSync(path, { force: true });
  });
});

describe("runById", () => {
  it("finds a run by name even though the policy text has changed", () => {
    // The patch workflow: the wording was edited, so the hash no longer
    // matches and previousRun cannot see it. Only the id can.
    const path = join(tmpdir(), `lacuna-byid-${randomUUID()}.sqlite`);
    const db = openStore(path);
    putCompiled(db, policy);

    const id = saveRun(db, {
      policy,
      target: { kind: "local", url: null, model: null },
      cases: [attackCase],
      decisions: [],
      findings: [],
      score: scoreRun({ id: "p", name: "p", text: policy.text, intents: policy.intents, actions: policy.actions, hardLimits: {} }, [attackCase], []),
      startedAt: "2026-01-01T00:00:00.000Z",
    });

    const edited = { ...policy, text: `${policy.text} Approval is required over $50.` };
    expect(previousRun(db, edited.text)).toBeUndefined();

    const byId = runById(db, id);
    expect(byId?.id).toBe(id);
    expect(byId?.cases).toHaveLength(1);
    expect(byId?.cases[0]?.id).toBe(attackCase.id);

    db.close();
    rmSync(path, { force: true });
  });

  it("returns nothing for a run that does not exist", () => {
    const path = join(tmpdir(), `lacuna-byid-${randomUUID()}.sqlite`);
    const db = openStore(path);
    expect(runById(db, "no-such-run")).toBeUndefined();
    db.close();
    rmSync(path, { force: true });
  });
});
