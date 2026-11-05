import { kite, kiteBaseUrl } from "@lacuna/engine";

/*
 * What Kite will enforce on this agent whatever its instructions say.
 *
 * These are the caps the prose cannot talk its way past, and they are the
 * reason an audit of this agent is worth more than an audit of a prompt: a
 * finding that moves more than the per-transaction cap would have been stopped
 * by the session, and a finding that moves less would not. Lacuna records them
 * as the policy's hard limits so a report can tell those two apart.
 */
export interface HardLimits {
  sessionId: string | null;
  perTransaction: number | null;
  perSession: number | null;
  spentSoFar: number | null;
  // What the agent is pointed at, so a report says which Kite it means.
  backend: string | null;
}

export const NO_LIMITS: HardLimits = {
  sessionId: null,
  perTransaction: null,
  perSession: null,
  spentSoFar: null,
  backend: null,
};

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/*
 * Kite has moved field names between releases before, so this reads the shapes
 * it is known to emit rather than one. An unreadable payload reports no limits,
 * which is honest: it means this agent cannot show a cap, not that it has none.
 */
export function readLimits(payload: unknown, backend: string | null = null): HardLimits {
  const body = payload as { sessions?: unknown[] } | null;
  const sessions = Array.isArray(body?.sessions) ? body.sessions : [];
  const first = sessions[0] as
    | {
        id?: string;
        session_id?: string;
        delegation?: {
          payment_policy?: Record<string, unknown>;
          spending_limits?: Record<string, unknown>;
        };
        payment_policy?: Record<string, unknown>;
        spending_limits?: Record<string, unknown>;
        usage?: Record<string, unknown>;
      }
    | undefined;

  if (!first) return { ...NO_LIMITS, backend };

  // Live staging returns delegation.payment_policy. Earlier builds returned
  // delegation.spending_limits. Both are read rather than betting on one.
  const spend =
    first.delegation?.payment_policy ??
    first.delegation?.spending_limits ??
    first.payment_policy ??
    first.spending_limits ??
    {};
  const usage = first.usage ?? {};

  return {
    sessionId: first.id ?? first.session_id ?? null,
    perTransaction: num(spend["max_amount_per_tx"] ?? spend["maxAmountPerTx"]),
    perSession: num(spend["max_total_amount"] ?? spend["maxTotalAmount"]),
    spentSoFar: num(usage["spent_total"] ?? usage["spentTotal"]),
    backend,
  };
}

// The shape Lacuna's policy schema wants: a flat map of named numeric caps.
export function toHardLimits(limits: HardLimits): Record<string, number> {
  const out: Record<string, number> = {};
  if (limits.perTransaction !== null) out["kite_per_transaction"] = limits.perTransaction;
  if (limits.perSession !== null) out["kite_per_session"] = limits.perSession;
  return out;
}

export async function currentLimits(): Promise<HardLimits> {
  const backend = kiteBaseUrl() ?? "https://passport.prod.gokite.ai";
  const result = await kite.activeSessions();
  if (!result.ok) return { ...NO_LIMITS, backend };
  return readLimits(result.value, backend);
}
