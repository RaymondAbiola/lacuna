import { readFileSync } from "node:fs";
import { generateLogicalAttacks } from "../attack-logical.js";
import { compilePolicy } from "../compile.js";

// Compile a policy, then attack it logically, and print the cases for
// inspection. Nothing is executed or judged yet: this commit only has to
// produce cases worth running.

async function main(): Promise<void> {
  const file = process.argv[2];
  const text = (file && file !== "-" ? readFileSync(file, "utf8") : readFileSync(0, "utf8")).trim();
  if (text.length === 0) {
    console.error("no policy text given");
    process.exit(1);
  }

  const compiled = await compilePolicy(text);
  if (!compiled.ok) {
    console.error(`compile failed (${compiled.reason}): ${compiled.message}`);
    process.exit(1);
  }

  const attacks = await generateLogicalAttacks(compiled.value);
  if (!attacks.ok) {
    console.error(`attack generation failed (${attacks.reason}): ${attacks.message}`);
    process.exit(1);
  }

  const byFamily = new Map<string, number>();
  for (const c of attacks.value) byFamily.set(c.family, (byFamily.get(c.family) ?? 0) + 1);

  console.log("");
  console.log(`  ${attacks.value.length} cases across ${byFamily.size} families`);
  console.log(
    "  " + [...byFamily.entries()].map(([f, n]) => `${f}=${n}`).join("  "),
  );

  for (const c of attacks.value) {
    console.log("");
    console.log(`  ${c.id}  ${c.family}  expects ${c.expectedByIntent}  probes [${c.probes.join(",")}]`);
    console.log(`     scenario : ${c.scenario}`);
    console.log(`     request  : ${c.request}`);
    console.log(`     why      : ${c.rationale}`);
  }

  const unprobed = attacks.value.filter((c) => c.probes.length === 0).length;
  console.log("");
  console.log(`  cases probing no declared intent: ${unprobed}`);
  console.log(
    `  tokens: compile ${compiled.usage.input}/${compiled.usage.output}, attack ${attacks.usage.input}/${attacks.usage.output}`,
  );
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
