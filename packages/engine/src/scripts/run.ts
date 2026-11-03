import { readFileSync } from "node:fs";
import { generateLogicalAttacks } from "../attack-logical.js";
import { compilePolicy } from "../compile.js";
import { countVerdicts, isInconclusive, runCases } from "../harness.js";
import { localTarget } from "../target.js";
import { adjudicate } from "../adjudicate.js";
import { summarise, triage } from "../triage.js";

// Compile, attack, execute. Prints expected against actual for every case.
// A mismatch is a candidate lacuna, not yet a finding: commit 7 judges them.

async function main(): Promise<void> {
  const file = process.argv[2];
  const kronos = process.argv.includes("--kronos");
  const text = (file && file !== "-" ? readFileSync(file, "utf8") : readFileSync(0, "utf8")).trim();

  const compiled = await compilePolicy(text);
  if (!compiled.ok) {
    console.error(`compile failed: ${compiled.message}`);
    process.exit(1);
  }

  const attacks = await generateLogicalAttacks(compiled.value);
  if (!attacks.ok) {
    console.error(`attack generation failed: ${attacks.message}`);
    process.exit(1);
  }

  const target = localTarget({ kronos });
  console.log("");
  console.log(`  target: local, kronos ${kronos ? "on" : "off"}`);
  console.log(`  running ${attacks.value.length} cases`);

  const decisions = await runCases(target, compiled.value, attacks.value, {
    concurrency: 3,
    onProgress: (done, total) => process.stdout.write(`\r  ${done}/${total}   `),
  });
  process.stdout.write("\r");

  console.log("");
  const counts = countVerdicts(decisions);
  console.log(
    `  verdicts: allow=${counts.allow} deny=${counts.deny} escalate=${counts.escalate} error=${counts.error}`,
  );
  const verdictQuality = isInconclusive(decisions);
  if (verdictQuality.inconclusive) {
    console.log(`  INCONCLUSIVE: ${verdictQuality.why}`);
    console.log("  a clean result here means the policy was not exercised, not that it is sound");
  }
  console.log("");

  let mismatches = 0;
  for (const [i, attack] of attacks.value.entries()) {
    const d = decisions[i];
    if (!d) continue;

    // "unspecified" means the intent does not settle it, so any verdict is
    // defensible and only the adjudicator can say whether it mattered.
    const agrees = attack.expectedByIntent === "unspecified" || d.verdict === attack.expectedByIntent;
    if (!agrees) mismatches += 1;

    const mark = attack.expectedByIntent === "unspecified" ? "?" : agrees ? " " : "!";
    console.log(
      `  ${mark} ${attack.id}  ${attack.family.padEnd(15)} expected ${attack.expectedByIntent.padEnd(11)} got ${d.verdict.padEnd(9)} ${d.amount !== null && d.amount > 0 ? "$" + d.amount : ""}`,
    );
    if (!agrees) console.log(`      target said: ${d.reasoning.slice(0, 150)}`);
  }

  const triaged = attacks.value.map((a, i) => triage(a, decisions[i]!));
  const summary = summarise(triaged);
  console.log("");
  console.log(`  triage: ${summary.candidates} candidate(s), ${summary.held} held`);
  for (const t of triaged) {
    if (!t.candidate) console.log(`     held: ${t.held}`);
  }

  console.log("");
  console.log("  adjudicating candidates");

  let confirmed = 0;
  let rejected = 0;
  let spent = { input: 0, output: 0 };

  for (const [i, attack] of attacks.value.entries()) {
    const d = decisions[i];
    if (!d) continue;
    if (!triaged[i]?.candidate) continue;

    const verdict = await adjudicate(compiled.value, attack, d);
    if (!verdict.ok) {
      console.log(`     ${attack.id}  adjudication failed: ${verdict.message.slice(0, 80)}`);
      continue;
    }
    spent = { input: spent.input + verdict.usage.input, output: spent.output + verdict.usage.output };

    if (!verdict.value.real) {
      rejected += 1;
      console.log("");
      console.log(`  REJECTED ${attack.id}`);
      console.log(`     ${verdict.value.reason.slice(0, 220)}`);
      continue;
    }

    confirmed += 1;
    const f = verdict.value.finding;
    console.log("");
    console.log(`  FINDING ${f.id}  ${f.kind}  ${f.severity}  conf ${f.confidence.toFixed(2)}`);
    console.log(`     ${f.summary}`);
    console.log(`     why: ${f.adjudication.slice(0, 300)}`);
    for (const q of f.implicatedText) console.log(`     quotes: "${q}"`);
    if (f.implicatedText.length === 0) console.log("     quotes: none survived verification");
  }

  console.log("");
  console.log(`  confirmed ${confirmed}, rejected ${rejected}, from ${summary.candidates} candidate(s)`);
  console.log(`  mismatches seen before judging: ${mismatches}`);
  console.log(`  adjudication tokens: ${spent.input} in, ${spent.output} out`);
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
