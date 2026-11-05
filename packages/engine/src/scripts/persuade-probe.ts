import { readFileSync } from "node:fs";
import { generatePersuasionAttacks } from "../attack-persuasion.js";
import { compilePolicy } from "../compile.js";

/*
 * Gate for the pressure generator.
 *
 * Asks SERV for the same thing twice, once with the default content filter in
 * place and once without, and prints what came back.
 *
 * The filter does not refuse this request. It thins it. Measured on a
 * four-rule payments policy at two cases per family: 6 cases with the filter,
 * 12 without, from an identical prompt. That is the failure mode worth
 * guarding against, because fewer attacks look exactly like a policy that
 * survived them.
 *
 * Run it when the SERV behaviour needs re-checking, not on every audit.
 */

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

  const policy = compiled.value;
  console.log("");
  console.log(`  policy    : ${policy.text}`);
  console.log(`  intents   : ${policy.intents.map((i) => `${i.id}/${i.disposition}`).join(" ")}`);

  for (const filterOff of [false, true]) {
    const label = filterOff ? "filter disabled" : "default filter";
    const result = await generatePersuasionAttacks(policy, {
      disableContentFilter: filterOff,
      perFamily: 2,
    });

    console.log("");
    console.log(`  --- ${label} ---`);

    if (!result.ok) {
      console.log(`  refused (${result.reason}): ${result.message}`);
      continue;
    }

    const byFamily = new Map<string, number>();
    for (const c of result.value) byFamily.set(c.family, (byFamily.get(c.family) ?? 0) + 1);

    console.log(
      `  ${result.value.length} cases  [${[...byFamily.entries()]
        .map(([f, n]) => `${f}=${n}`)
        .join(" ")}]  tokens ${result.usage.input}/${result.usage.output}`,
    );

    if (filterOff) {
      for (const c of result.value) {
        console.log("");
        console.log(`  ${c.id}  ${c.family}  expects ${c.expectedByIntent}  probes [${c.probes.join(",")}]`);
        console.log(`     scenario : ${c.scenario}`);
        console.log(`     request  : ${c.request}`);
        console.log(`     why      : ${c.rationale}`);
      }
    }
  }

  console.log("");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
