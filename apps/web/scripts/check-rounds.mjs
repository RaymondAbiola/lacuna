import { readFileSync } from "node:fs";

/*
 * The call-it game is only worth playing if the recorded runs still disagree
 * with each other. The lunch run is not a round: its answer is in the hero. If every round leaks, the game is won by always saying so,
 * and a tool whose credibility rests on being able to clear a policy would be
 * teaching the opposite. Re-exporting a fixture must not be able to do that
 * quietly, so this runs before the build.
 */
const EXPECTED = [
  ["app/contrast.json", "holds"],
  ["app/agentrun.json", "leaks"],
];

let bad = 0;
for (const [path, want] of EXPECTED) {
  const run = JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
  const got = run.findings.length > 0 ? "leaks" : "holds";
  const mark = got === want ? "ok" : "CHANGED";
  if (got !== want) bad += 1;
  console.log(`  ${mark.padEnd(8)} ${path}  ${run.runId.slice(0, 8)}  ${got} (${run.findings.length} findings)`);
}

if (bad > 0) {
  console.error(
    `\n  ${bad} recorded run no longer matches what the game claims about it.` +
      `\n  Either re-pick the rounds in app/components/Scoreboard.tsx or keep the old fixture.\n`,
  );
  process.exit(1);
}

if (!EXPECTED.some(([, want]) => want === "holds")) {
  console.error("\n  no round holds, so the game can be won by never thinking\n");
  process.exit(1);
}
