import { containment, unsettled, unsettledAmount } from "@lacuna/core";
import { audit } from "../audit.js";
import { httpTarget } from "../http-target.js";

/*
 * Audits a deployed agent rather than a prompt.
 *
 * The agent publishes two things: the policy it believes it follows, and the
 * caps its host enforces whatever that policy says. Lacuna takes both, attacks
 * the policy on the wording and on the agent, and then sorts what it found by
 * whether anything outside the prose would have stopped it.
 *
 *   usage: audit-agent <base-url> [--samples=n] [--per-family=n]
 */

interface AgentLimits {
  policy: string;
  hardLimits: Record<string, number>;
  limits: { sessionId: string | null; backend: string | null };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const base = (args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:4100").replace(/\/+$/, "");
  const samples = Number(args.find((a) => a.startsWith("--samples="))?.slice(10) ?? 1);
  const perFamily = Number(args.find((a) => a.startsWith("--per-family="))?.slice(13) ?? 2);

  const response = await fetch(`${base}/limits`).catch((error: unknown) => {
    throw new Error(`could not reach the agent at ${base}: ${String(error)}`);
  });
  if (!response.ok) throw new Error(`the agent answered ${response.status} at /limits`);

  const declared = (await response.json()) as AgentLimits;
  const caps = Object.entries(declared.hardLimits);

  console.log("");
  console.log(`  agent    ${base}`);
  console.log(`  policy   ${declared.policy}`);
  console.log(
    caps.length > 0
      ? `  enforced ${caps.map(([k, v]) => `${k.replace("kite_", "")}=$${v}`).join("  ")}  (${declared.limits.backend})`
      : "  enforced nothing: this agent has no host caps to fall back on",
  );
  console.log(`  session  ${declared.limits.sessionId ?? "none"}`);

  const result = await audit(declared.policy, {
    dbPath: process.env["LACUNA_DB"] ?? "lacuna.sqlite",
    target: httpTarget({ url: `${base}/decide`, allowPrivate: true, timeoutMs: 60_000 }),
    hardLimits: declared.hardLimits,
    samples,
    perFamily,
    onProgress: (stage, detail) => console.log(`  ${stage.padEnd(8)} ${detail}`),
  });

  const { containment: split } = result;

  console.log("");
  console.log(`  run      ${result.runId}`);
  console.log(
    `  integrity ${result.score.integrity}%   coverage ${result.score.coverage}%   ` +
      `exposure ${result.score.exposure}   findings ${result.findings.length}`,
  );

  // Said plainly next to the score, because a reader who sees 100% above a
  // list of findings will assume one of the two numbers is lying.
  const blind = unsettled(result.findings);
  if (blind.length > 0) {
    const moved = unsettledAmount(result.findings);
    console.log(
      `  ${blind.length} of those breached no commitment: the policy never took a position` +
        (moved > 0 ? `, and $${moved.toFixed(2)} moved anyway` : ""),
    );
  }

  if (result.findings.length === 0) {
    console.log("");
    console.log("  Nothing was confirmed against this agent.");
    console.log("");
    return;
  }

  console.log("");
  console.log(
    `  ${split.stopped} would be stopped by the host, ` +
      `${split.live} would not, ${split.unknown} cannot be judged`,
  );
  if (split.live > 0) {
    console.log(`  $${split.liveAmount.toFixed(2)} moves on wording alone, under every cap`);
  }

  for (const kind of ["live", "stopped", "unknown"] as const) {
    const group = result.findings.filter((f) => containment(f, declared.hardLimits) === kind);
    if (group.length === 0) continue;

    console.log("");
    console.log(
      kind === "live"
        ? "  --- nothing stops these ---"
        : kind === "stopped"
          ? "  --- the host cap refuses these whatever the policy said ---"
          : "  --- no amount was named, so containment is unknown ---",
    );

    for (const f of group) {
      const amount = f.evidence.decision.amount;
      console.log("");
      console.log(`  ${f.id}  ${f.evidence.case.family}  ${f.severity}  ${amount === null ? "no amount" : `$${amount}`}`);
      console.log(`     ${f.summary.slice(0, 240)}`);
    }
  }

  console.log("");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
