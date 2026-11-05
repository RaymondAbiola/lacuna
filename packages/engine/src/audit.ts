import type {
  AttackCase,
  CompiledPolicy,
  ContainmentSummary,
  Finding,
  Score,
  ReplayDelta,
  ScoreDelta,
} from "@lacuna/core";
import { scoreRun, compareRuns, compareReplay, summariseContainment } from "@lacuna/core";
import { adjudicate } from "./adjudicate.js";
import { generateLogicalAttacks } from "./attack-logical.js";
import { generatePersuasionAttacks } from "./attack-persuasion.js";
import { compilePolicy } from "./compile.js";
import { isInconclusive, runCases } from "./harness.js";
import { localTarget, type Persona, type Target } from "./target.js";
import {
  cachedCompile,
  openStore,
  previousRun,
  runById,
  putCompiled,
  saveRun,
  type Store,
} from "./store.js";
import { summarise, triage, type Triage } from "./triage.js";

export interface AuditOptions {
  dbPath?: string;
  target?: Target;
  kronos?: boolean;
  perFamily?: number;
  // How many times each case is put to the target. One sample understates
  // risk, because a cautious reply is not proof the policy holds.
  samples?: number;
  // Which agent the policy is tested against. "eager" asks whether the
  // wording holds on its own, rather than resting on a timid agent.
  persona?: Persona;
  /*
   * Caps the host enforces outside the prose, read from the agent under test.
   * A finding a cap would have refused is a weaker result than one nothing
   * refuses, and without these the report cannot tell the two apart.
   */
  hardLimits?: Record<string, number>;
  // Also attack the agent rather than only the text. Off makes a run cheaper
  // and narrower, and the report says which of the two was asked for.
  persuasion?: boolean;
  // Replay the previous run's cases instead of generating new ones. Required
  // for a before-and-after comparison to mean anything, and free: no
  // generation call is made.
  replay?: boolean;
  /*
   * Replay one named run's cases, even against different policy text. This is
   * the patch workflow: fix the wording, put the same attacks to it, and see
   * what actually changed. replay looks the run up by policy hash, which
   * cannot find anything once the text has been edited.
   */
  replayFrom?: string;
  label?: string;
  onProgress?: (stage: string, detail: string) => void;
}

export interface AuditResult {
  runId: string;
  policy: CompiledPolicy;
  cases: AttackCase[];
  triaged: Triage[];
  findings: Finding[];
  score: Score;
  delta: ScoreDelta | undefined;
  inconclusive: { inconclusive: boolean; why: string };
  containment: ContainmentSummary;
  replayed: boolean;
  // Which run the attacks came from, when they were not generated here.
  replayedFrom: string | undefined;
  // Case-by-case change against that run. Only meaningful under replay,
  // because it is the identical case set that makes the comparison exact.
  replayDelta: ReplayDelta | undefined;
  compileCached: boolean;
  usage: { input: number; output: number };
}

export async function audit(text: string, options: AuditOptions = {}): Promise<AuditResult> {
  const db: Store = openStore(options.dbPath ?? "lacuna.sqlite");
  const startedAt = new Date().toISOString();
  const say = options.onProgress ?? (() => {});
  let usage = { input: 0, output: 0 };
  const spend = (u: { input: number; output: number }) => {
    usage = { input: usage.input + u.input, output: usage.output + u.output };
  };

  const prior = previousRun(db, text);

  const cached = cachedCompile(db, text);
  let policy: CompiledPolicy;
  if (cached) {
    say("compile", "reused the cached compile for this policy text");
    policy = cached;
  } else {
    say("compile", "reading the policy");
    const compiled = await compilePolicy(text);
    if (!compiled.ok) throw new Error(`compile failed: ${compiled.message}`);
    spend(compiled.usage);
    policy = compiled.value;
    putCompiled(db, policy);
  }

  const source = options.replayFrom ? runById(db, options.replayFrom) : undefined;

  let cases: AttackCase[];
  let replayed = false;
  if (source && source.cases.length > 0) {
    say("attack", `replaying ${source.cases.length} cases from run ${source.id.slice(0, 8)}`);
    cases = source.cases;
    replayed = true;
  } else if (options.replay && prior && prior.cases.length > 0) {
    say("attack", `replaying ${prior.cases.length} cases from the previous run`);
    cases = prior.cases;
    replayed = true;
  } else {
    say("attack", "generating cases");
    const generated = await generateLogicalAttacks(policy, {
      ...(options.perFamily !== undefined ? { perFamily: options.perFamily } : {}),
    });
    if (!generated.ok) throw new Error(`attack generation failed: ${generated.message}`);
    spend(generated.usage);
    cases = generated.value;

    // Pressure tests are additive. A policy that defends nothing still audits,
    // and a refusal from the content filter costs the run its pressure cases
    // but never the whole run.
    if (options.persuasion ?? true) {
      const pressured = await generatePersuasionAttacks(policy, {
        ...(options.perFamily !== undefined ? { perFamily: options.perFamily } : {}),
      });
      if (pressured.ok) {
        spend(pressured.usage);
        cases = [...cases, ...pressured.value];
        say("attack", `${generated.value.length} on the text, ${pressured.value.length} on the agent`);
      } else {
        say("attack", `no pressure cases: ${pressured.message}`);
      }
    }
  }

  const target =
    options.target ??
    localTarget({ kronos: options.kronos ?? false, persona: options.persona ?? "eager" });
  say("execute", `running ${cases.length} cases`);
  const decisions = await runCases(target, policy, cases, {
    concurrency: 3,
    samples: options.samples ?? 1,
  });

  const triaged = cases.map((c, i) => triage(c, decisions[i]!));
  const summary = summarise(triaged);
  say("triage", `${summary.candidates} candidate(s), ${summary.held} held`);

  const findings: Finding[] = [];

  /*
   * Judging is one call per candidate and it is the slowest stage by far.
   * Without a count and a running position the page looks hung, and somebody
   * waiting on it reasonably concludes it broke and leaves.
   */
  const total = triaged.filter((t) => t.candidate).length;
  if (total > 0) {
    say(
      "judge",
      `weighing ${total} candidate${total === 1 ? "" : "s"} one at a time, the slowest part`,
    );
  }

  let judged = 0;
  for (const [i, attack] of cases.entries()) {
    if (!triaged[i]?.candidate) continue;
    const decision = decisions[i];
    if (!decision) continue;

    judged += 1;
    say("judge", `${judged} of ${total}: ${attack.id}`);

    const verdict = await adjudicate(policy, attack, decision);
    if (!verdict.ok) {
      say("judge", `${attack.id} could not be judged: ${verdict.message.slice(0, 80)}`);
      continue;
    }
    spend(verdict.usage);
    if (verdict.value.real) findings.push(verdict.value.finding);
    else say("judge", `rejected ${attack.id}`);
  }

  const score = scoreRun(
    {
      id: "p",
      name: "policy",
      text: policy.text,
      intents: policy.intents,
      actions: policy.actions,
      hardLimits: options.hardLimits ?? {},
    },
    cases,
    findings,
  );

  const runId = saveRun(db, {
    policy,
    target: { kind: target.describe.kind, url: target.describe.url, model: target.describe.model },
    cases,
    decisions,
    findings,
    score,
    startedAt,
    hardLimits: options.hardLimits ?? {},
    ...(options.label !== undefined ? { label: options.label } : {}),
  });

  // Only comparable when the same attacks were replayed. Comparing against a
  // different case set would report a change the patch did not cause.
  const delta =
    replayed && prior
      ? compareRuns({ score: prior.score, findings: prior.findings }, { score, findings })
      : undefined;

  /*
   * The comparison that survives an edited policy. compareRuns matches intent
   * ids, which the compiler reassigns whenever the wording changes; this
   * matches the cases, which replay holds identical by construction.
   */
  const baseline = source ?? (replayed ? prior : undefined);
  const replayDelta = baseline
    ? compareReplay(
        { score: baseline.score, findings: baseline.findings },
        { score, findings },
      )
    : undefined;

  db.close();

  return {
    runId,
    policy,
    cases,
    triaged,
    findings,
    score,
    delta,
    inconclusive: isInconclusive(decisions),
    containment: summariseContainment(findings, options.hardLimits ?? {}),
    replayed,
    replayedFrom: baseline?.id,
    replayDelta,
    compileCached: Boolean(cached),
    usage,
  };
}
