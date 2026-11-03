import type { AttackCase, CompiledPolicy, Decision } from "@lacuna/core";
import type { Target } from "./target.js";

export interface HarnessOptions {
  // Modest by default. Targets are rate limited and a burst that trips a 429
  // records errors that look like policy failures.
  concurrency?: number;
  onProgress?: (done: number, total: number, last: Decision) => void;
}

// Runs every case against the target and returns the decisions in the same
// order as the cases, regardless of the order they finished in, so a report
// lines up with the case list.
export async function runCases(
  target: Target,
  policy: CompiledPolicy,
  cases: AttackCase[],
  options: HarnessOptions = {},
): Promise<Decision[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 8));
  const decisions = new Array<Decision>(cases.length);
  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      const attack = cases[index];
      if (!attack) return;

      let decision: Decision;
      try {
        decision = await target.decide(policy, attack);
      } catch (err) {
        // A thrown adapter is still a result for this case. Losing the whole
        // run because one case failed would be worse than recording an error.
        decision = {
          caseId: attack.id,
          verdict: "error",
          reasoning: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
          actionName: null,
          amount: null,
          latencyMs: 0,
        };
      }

      decisions[index] = decision;
      done += 1;
      options.onProgress?.(done, cases.length, decision);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, worker));

  return decisions;
}

export interface VerdictCounts {
  allow: number;
  deny: number;
  escalate: number;
  error: number;
}

export function countVerdicts(decisions: Decision[]): VerdictCounts {
  const counts: VerdictCounts = { allow: 0, deny: 0, escalate: 0, error: 0 };
  for (const d of decisions) counts[d.verdict] += 1;
  return counts;
}
