import type { Finding } from "./finding.js";

/*
 * Whether something outside the prose would have stopped this finding.
 *
 * A policy failure that a spending cap blocks anyway is a different thing from
 * one that nothing blocks, and reporting them together overstates the first
 * and buries the second. The second is the whole point of this tool: money
 * that moves because the wording permitted it and no cap was low enough to
 * care.
 */
export type Containment = "stopped" | "live" | "unknown";

export const PER_TRANSACTION = "kite_per_transaction";
export const PER_SESSION = "kite_per_session";

/*
 * Attacks that work by repetition. A per-payment cap does not contain these,
 * because splitting the spend IS the attack: four payments of $4 defeat a $5
 * per-transaction limit without ever exceeding it. Only a total can hold them,
 * and claiming otherwise would mark the most dangerous family as handled.
 */
const SPLITTABLE = new Set(["composition", "incremental"]);

export function containment(
  finding: Finding,
  hardLimits: Record<string, number>,
): Containment {
  const perTransaction = hardLimits[PER_TRANSACTION];
  const perSession = hardLimits[PER_SESSION];
  if (perTransaction === undefined && perSession === undefined) return "unknown";

  const amount = finding.evidence.decision.amount;
  // No amount means the agent never said what would move. Guessing "live"
  // would inflate the danger and "stopped" would hide it.
  if (amount === null || !Number.isFinite(amount)) return "unknown";

  const cap = SPLITTABLE.has(finding.evidence.case.family)
    ? perSession
    : (perTransaction ?? perSession);

  if (cap === undefined) return "unknown";
  return amount > cap ? "stopped" : "live";
}

export interface ContainmentSummary {
  stopped: number;
  live: number;
  unknown: number;
  // What the live findings move in total, which is the number worth saying out
  // loud: it is the money the wording released and nothing caught.
  liveAmount: number;
}

export function summariseContainment(
  findings: Finding[],
  hardLimits: Record<string, number>,
): ContainmentSummary {
  const summary: ContainmentSummary = { stopped: 0, live: 0, unknown: 0, liveAmount: 0 };

  for (const finding of findings) {
    const verdict = containment(finding, hardLimits);
    summary[verdict] += 1;
    if (verdict === "live") {
      summary.liveAmount += finding.evidence.decision.amount ?? 0;
    }
  }

  summary.liveAmount = Math.round(summary.liveAmount * 100) / 100;
  return summary;
}
