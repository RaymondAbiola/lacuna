/*
 * A spend guard for the public arena.
 *
 * Every audit costs real SERV credits, and the balance behind this is finite
 * and not replenishable mid-judging. Without a limit, one person holding down
 * a key empties it and every judge who arrives afterwards sees a broken tool.
 *
 * The counters live in memory. A restart clears them, which is a real
 * weakness and the honest trade: persisting them would mean a database the
 * deployment does not otherwise need, and an attacker who can restart the
 * process has already won. What this stops is the ordinary case, which is one
 * impatient visitor and one loop left running.
 */

export interface GuardLimits {
  perIpPerHour: number;
  globalPerDay: number;
}

export const DEFAULT_LIMITS: GuardLimits = {
  perIpPerHour: Number(process.env["LACUNA_RUNS_PER_IP_HOUR"] ?? 5),
  globalPerDay: Number(process.env["LACUNA_RUNS_PER_DAY"] ?? 120),
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const byIp = new Map<string, number[]>();
let globalRuns: number[] = [];

function prune(times: number[], window: number, now: number): number[] {
  return times.filter((t) => now - t < window);
}

export interface GuardVerdict {
  ok: boolean;
  // Said plainly to the visitor rather than hidden behind a bare 429.
  why?: string;
  retryAfterSeconds?: number;
}

/*
 * Trusts the leftmost x-forwarded-for entry, which is what the platform sets
 * and what a client can also spoof. That is acceptable here: this is a budget
 * guard, not an access control, and the global cap is the one that actually
 * protects the balance.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkGuard(
  ip: string,
  limits: GuardLimits = DEFAULT_LIMITS,
  now: number = Date.now(),
): GuardVerdict {
  globalRuns = prune(globalRuns, DAY, now);
  if (globalRuns.length >= limits.globalPerDay) {
    const oldest = globalRuns[0] ?? now;
    return {
      ok: false,
      why: "The arena has run its budget for today. The recorded runs on the landing page are real and cost nothing to read.",
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + DAY - now) / 1000)),
    };
  }

  const mine = prune(byIp.get(ip) ?? [], HOUR, now);
  if (mine.length >= limits.perIpPerHour) {
    const oldest = mine[0] ?? now;
    byIp.set(ip, mine);
    return {
      ok: false,
      why: `That is ${limits.perIpPerHour} audits in an hour, which is the limit from one address.`,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + HOUR - now) / 1000)),
    };
  }

  byIp.set(ip, mine);
  return { ok: true };
}

// Called only once a run is actually starting, so a rejected request never
// counts against the budget it was refused for.
export function recordRun(ip: string, now: number = Date.now()): void {
  globalRuns = prune(globalRuns, DAY, now);
  globalRuns.push(now);
  const mine = prune(byIp.get(ip) ?? [], HOUR, now);
  mine.push(now);
  byIp.set(ip, mine);
}

// Test seam. Nothing in the product calls this.
export function resetGuard(): void {
  byIp.clear();
  globalRuns = [];
}
