import { readFileSync, writeFileSync } from "node:fs";
import { audit } from "../audit.js";
import { renderReport } from "../report.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const replay = args.includes("--replay");
  const kronos = args.includes("--kronos");
  const out = args.find((a) => a.startsWith("--out="))?.slice(6);
  const samples = Number(args.find((a) => a.startsWith("--samples="))?.slice(10) ?? 1);
  const persona = args.includes("--cautious") ? "cautious" as const : "eager" as const;
  const perFamily = Number(args.find((a) => a.startsWith("--per-family="))?.slice(13) ?? 3);

  const text = (file && file !== "-" ? readFileSync(file, "utf8") : readFileSync(0, "utf8")).trim();
  if (text.length === 0) {
    console.error("no policy text given");
    process.exit(1);
  }

  const result = await audit(text, {
    dbPath: process.env["LACUNA_DB"] ?? "lacuna.sqlite",
    replay,
    kronos,
    samples,
    persona,
    perFamily,
    onProgress: (stage, detail) => console.log(`  ${stage.padEnd(8)} ${detail}`),
  });

  const report = renderReport({
    policy: result.policy,
    cases: result.cases,
    decisions: [],
    triaged: result.triaged,
    findings: result.findings,
    score: result.score,
    inconclusive: result.inconclusive,
    target: { kind: "local", model: persona, kronos },
    ...(result.delta ? { delta: result.delta } : {}),
    runId: result.runId,
  });

  if (out) {
    writeFileSync(out, report, "utf8");
    console.log(`  report   written to ${out}`);
  } else {
    console.log("");
    console.log(report);
  }

  console.log("");
  console.log(
    `  run ${result.runId}  compile ${result.compileCached ? "cached" : "fresh"}  cases ${result.replayed ? "replayed" : "generated"}  samples ${samples}  tokens ${result.usage.input}/${result.usage.output}`,
  );
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
