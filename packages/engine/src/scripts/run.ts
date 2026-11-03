import { readFileSync } from "node:fs";
import { generateLogicalAttacks } from "../attack-logical.js";
import { compilePolicy } from "../compile.js";
import { countVerdicts, runCases } from "../harness.js";
import { localTarget } from "../target.js";

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

  console.log("");
  console.log(`  candidate lacunae: ${mismatches} of ${attacks.value.length}`);
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
