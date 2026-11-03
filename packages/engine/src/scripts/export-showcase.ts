import { writeFileSync } from "node:fs";
import { listRuns, openStore } from "../store.js";
import { summarise, triage } from "../triage.js";

// Lifts one real recorded run out of a run store and writes it to a committed
// fixture, so the landing page can argue from genuine evidence without making
// a single API call. The run id travels with it, which is what makes the
// numbers on the page attributable rather than decorative.

function usage(): never {
  console.error("usage: export-showcase <db-path> <run-id-prefix> <out-path>");
  process.exit(1);
}

const [dbPath, prefix, outPath] = process.argv.slice(2);
if (!dbPath || !prefix || !outPath) usage();

const db = openStore(dbPath);
const run = listRuns(db, 200).find((r) => r.id.startsWith(prefix));
if (!run) {
  console.error(`no run starting ${prefix} in ${dbPath}`);
  process.exit(1);
}

const policyRow = db
  .prepare("SELECT text, compiled FROM policies WHERE hash = (SELECT policy_hash FROM runs WHERE id = ?)")
  .get(run.id) as { text: string; compiled: string } | undefined;

if (!policyRow) {
  console.error("the run's policy is no longer in this store");
  process.exit(1);
}

const policy = JSON.parse(policyRow.compiled) as {
  text: string;
  clauses: { index: number; text: string; form: string }[];
  intents: {
    id: string;
    statement: string;
    disposition: string;
    sourceClauses: number[];
    confidence: number;
  }[];
  undefinedTerms: { term: string; why: string }[];
  openQuestions: string[];
};

const breached = new Set(run.findings.flatMap((f) => f.breaches));
const triaged = run.cases.map((c, i) => triage(c, run.decisions[i]!));
const counts = summarise(triaged);

const families = new Set(run.cases.map((c) => c.family));

const showcase = {
  runId: run.id,
  recordedAt: run.startedAt,
  policyText: policy.text,
  score: run.score,
  inconclusive: { inconclusive: false, why: "" },
  intents: policy.intents.map((i) => ({
    id: i.id,
    statement: i.statement,
    disposition: i.disposition,
    stated: i.sourceClauses.length > 0,
    breached: breached.has(i.id),
  })),
  undefinedTerms: policy.undefinedTerms,
  openQuestions: policy.openQuestions,
  findings: run.findings.map((f) => ({
    id: f.id,
    kind: f.kind,
    severity: f.severity,
    summary: f.summary,
    adjudication: f.adjudication,
    implicatedText: f.implicatedText,
    scenario: f.evidence.case.scenario,
    request: f.evidence.case.request,
    verdict: f.evidence.decision.verdict,
    amount: f.evidence.decision.amount,
    reasoning: f.evidence.decision.reasoning,
  })),
  held: triaged.flatMap((t, i) => {
    if (t.candidate) return [];
    const c = run.cases[i];
    return c ? [{ id: c.id, family: c.family, why: t.held }] : [];
  }),
  // The procedure, for the five-step section. Counted here rather than in the
  // view so the page cannot drift from what the run actually did.
  procedure: {
    clauses: policy.clauses.length,
    commitments: policy.intents.length,
    cases: run.cases.length,
    families: families.size,
    candidates: counts.candidates,
    rejected: counts.candidates - run.findings.length,
    findings: run.findings.length,
  },
};

db.close();
writeFileSync(outPath, `${JSON.stringify(showcase, null, 2)}\n`, "utf8");

console.log(`  run        ${showcase.runId}`);
console.log(`  policy     ${showcase.policyText.replace(/\s+/g, " ").slice(0, 60)}`);
console.log(`  integrity  ${showcase.score.integrity}%  exposure ${showcase.score.exposure}`);
console.log(
  `  procedure  ${showcase.procedure.clauses} clause, ${showcase.procedure.cases} cases across ${showcase.procedure.families} families, ${showcase.procedure.candidates} candidates, ${showcase.procedure.rejected} rejected, ${showcase.procedure.findings} findings`,
);
console.log(`  amounts    ${showcase.findings.map((f) => f.amount).join(", ")}`);
console.log(`  written    ${outPath}`);
