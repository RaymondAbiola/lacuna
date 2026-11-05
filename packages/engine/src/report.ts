import { unsettled, unsettledAmount } from "@lacuna/core";
import type {
  AttackCase,
  CompiledPolicy,
  Decision,
  Finding,
  Score,
  ScoreDelta,
  Severity,
} from "@lacuna/core";
import type { Triage } from "./triage.js";

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export interface ReportInput {
  policy: CompiledPolicy;
  cases: AttackCase[];
  decisions: Decision[];
  triaged: Triage[];
  findings: Finding[];
  score: Score;
  inconclusive: { inconclusive: boolean; why: string };
  target: { kind: string; model: string | null; kronos: boolean };
  delta?: ScoreDelta;
  runId?: string;
}

function headline(score: Score, findings: Finding[]): string {
  const blind = unsettled(findings);
  const moved = unsettledAmount(findings);

  const rows = [
    `| | |`,
    `|---|---|`,
    `| Integrity | **${score.integrity}%** of the commitments put under attack held |`,
    `| Coverage | ${score.coverage}% of declared commitments were reached |`,
    `| Exposure | ${score.exposure} weighted |`,
    `| Cases | ${score.casesRun} run, ${score.findings} became findings |`,
  ];

  /*
   * Integrity cannot see a finding that breached nothing, so a policy that
   * never took a position reads as perfect. This row is what stops the
   * headline number quietly contradicting the findings printed below it.
   */
  if (blind.length > 0) {
    const moneyMoved = moved > 0 ? `: **$${moved.toFixed(2)}** moved anyway` : "";
    rows.push(
      `| Unsettled | ${blind.length} finding${blind.length === 1 ? "" : "s"} breached no ` +
        `commitment, because the policy never made one${moneyMoved} |`,
    );
  }

  return rows.join("\n");
}

export function renderReport(input: ReportInput): string {
  const { policy, score, findings } = input;
  const out: string[] = [];

  out.push(`# Lacuna report`);
  out.push("");
  out.push(
    `Target: ${input.target.kind}${input.target.model ? `, ${input.target.model}` : ""}, Kronos ${input.target.kronos ? "on" : "off"}.${input.runId ? ` Run \`${input.runId}\`.` : ""}`,
  );
  out.push("");

  if (input.inconclusive.inconclusive) {
    out.push(`> **Inconclusive.** ${input.inconclusive.why}.`);
    out.push(`>`);
    out.push(
      `> A clean result here means the policy was never exercised, not that it is sound. Treat the integrity figure below as unearned.`,
    );
    out.push("");
  }

  out.push(headline(score, findings));
  out.push("");

  if (input.delta) {
    const d = input.delta;
    out.push(`## Change since the last run`);
    out.push("");
    out.push(
      `Integrity ${d.integrity >= 0 ? "+" : ""}${d.integrity}, exposure ${d.exposure >= 0 ? "+" : ""}${d.exposure}.`,
    );
    if (d.fixed.length > 0) out.push(`Fixed: ${d.fixed.map((i) => `\`${i}\``).join(", ")}.`);
    if (d.regressed.length > 0)
      out.push(`**Regressed: ${d.regressed.map((i) => `\`${i}\``).join(", ")}.**`);
    if (d.fixed.length === 0 && d.regressed.length === 0)
      out.push(`No commitment changed state. The same attacks were replayed.`);
    out.push("");
  }

  out.push(`## What this policy was read as promising`);
  out.push("");
  out.push(
    `Lacuna inferred these from your wording. Anything you disagree with is worth correcting, because every finding below is a disagreement between one of these and what the text actually permits.`,
  );
  out.push("");
  for (const i of policy.intents) {
    const breached = findings.some((f) => f.breaches.includes(i.id));
    const provenance =
      i.sourceClauses.length > 0 ? `clause ${i.sourceClauses.join(", ")}` : "inferred, not stated";
    out.push(`- ${breached ? "**breached**" : "held"} \`${i.id}\` (${i.disposition}, ${provenance}) ${i.statement}`);
  }
  out.push("");

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  out.push(`## Findings (${sorted.length})`);
  out.push("");
  if (sorted.length === 0) {
    out.push(
      input.inconclusive.inconclusive
        ? `None, but see the warning above.`
        : `None. Every attack that reached a commitment was refused or escalated.`,
    );
    out.push("");
  }

  for (const f of sorted) {
    out.push(`### ${f.severity.toUpperCase()}: ${f.summary}`);
    out.push("");
    out.push(
      `\`${f.id}\` · ${f.kind.replace(/_/g, " ")} · breaches ${f.breaches.map((b) => `\`${b}\``).join(", ") || "no declared commitment"}`,
    );
    out.push("");

    if (f.implicatedText.length > 0) {
      out.push(`**The words responsible**`);
      out.push("");
      for (const q of f.implicatedText) out.push(`> ${q}`);
      out.push("");
    }

    out.push(`**What happened**`);
    out.push("");
    out.push(`Situation: ${f.evidence.case.scenario}`);
    out.push("");
    out.push(`Request: ${f.evidence.case.request}`);
    out.push("");
    out.push(
      `The agent chose **${f.evidence.decision.verdict}**${f.evidence.decision.amount ? ` and would move $${f.evidence.decision.amount}` : ""}, reasoning: ${f.evidence.decision.reasoning}`,
    );
    out.push("");
    out.push(`**Why this is a defect**`);
    out.push("");
    out.push(f.adjudication);
    out.push("");
  }

  if (policy.undefinedTerms.length > 0) {
    out.push(`## Terms this policy never defines`);
    out.push("");
    out.push(`Each of these decides an outcome and is left to the reader.`);
    out.push("");
    for (const t of policy.undefinedTerms) out.push(`- **${t.term}** ${t.why}`);
    out.push("");
  }

  const held = input.triaged
    .map((t, i) => ({ t, c: input.cases[i] }))
    .filter((x): x is { t: Extract<Triage, { candidate: false }>; c: AttackCase } =>
      Boolean(!x.t.candidate && x.c),
    );

  if (held.length > 0) {
    out.push(`## Attacks that did not become findings (${held.length})`);
    out.push("");
    out.push(`Reported so you can see what was tried, not only what failed.`);
    out.push("");
    for (const { t, c } of held) out.push(`- \`${c.id}\` ${c.family}: ${t.held}`);
    out.push("");
  }

  if (policy.openQuestions.length > 0) {
    out.push(`## Questions this policy leaves open`);
    out.push("");
    for (const q of policy.openQuestions) out.push(`- ${q}`);
    out.push("");
  }

  return out.join("\n");
}
