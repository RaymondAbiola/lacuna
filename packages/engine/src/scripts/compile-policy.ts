import { readFileSync } from "node:fs";
import { compilePolicy } from "../compile.js";

// Reads a policy from a file argument, or from stdin, and prints what LACUNA
// understands it to promise. This output is what the author confirms before
// any attack runs.

function readInput(): string {
  const file = process.argv[2];
  if (file && file !== "-") return readFileSync(file, "utf8");
  return readFileSync(0, "utf8");
}

async function main(): Promise<void> {
  const text = readInput().trim();
  if (text.length === 0) {
    console.error("no policy text given");
    process.exit(1);
  }

  const result = await compilePolicy(text);
  if (!result.ok) {
    console.error(`compile failed (${result.reason}): ${result.message}`);
    process.exit(1);
  }

  const p = result.value;
  console.log("");
  console.log(`  clauses: ${p.clauses.length}`);
  for (const c of p.clauses) console.log(`    [${c.index}] ${c.text}`);

  console.log("");
  console.log(`  intents LACUNA read from this, for you to confirm: ${p.intents.length}`);
  for (const i of p.intents) {
    const src = i.sourceClauses.length > 0 ? `from [${i.sourceClauses.join(",")}]` : "inferred";
    console.log(`    ${i.id}  ${i.disposition.padEnd(8)} conf ${i.confidence.toFixed(2)}  ${src}`);
    console.log(`         ${i.statement}`);
  }

  console.log("");
  console.log(`  actions implied: ${p.actions.length}`);
  for (const a of p.actions) {
    const flags = [a.movesMoney ? "money" : "", a.irreversible ? "irreversible" : ""]
      .filter(Boolean)
      .join(", ");
    console.log(`    ${a.name.padEnd(22)} ${flags}`);
  }

  console.log("");
  console.log(`  undefined terms: ${p.undefinedTerms.length}`);
  for (const t of p.undefinedTerms) console.log(`    "${t.term}" ${t.why}`);

  console.log("");
  console.log(`  open questions: ${p.openQuestions.length}`);
  for (const q of p.openQuestions) console.log(`    ${q}`);

  console.log("");
  console.log(`  ${result.model}: ${result.usage.input} in, ${result.usage.output} out`);
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
