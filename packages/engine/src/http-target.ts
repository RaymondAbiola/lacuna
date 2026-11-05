import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import type { AttackCase, CompiledPolicy, Decision } from "@lacuna/core";
import type { Target } from "./target.js";

/*
 * Audits an agent that is already running somewhere, over HTTP.
 *
 * This is the difference between testing a prompt we wrote and testing the
 * thing a builder actually deployed. The agent keeps its own instructions: by
 * default its policy is not sent, because an agent that only honours a policy
 * when the auditor hands it over was not honouring it in production either.
 *
 * What is sent:
 *   { caseId, scenario, request }            and policy only if asked for
 *
 * What must come back:
 *   { verdict: "allow" | "deny" | "escalate", reasoning, action?, amount? }
 *
 * Anything else is an error on the case, never a guess at what the agent
 * meant. A run that infers verdicts from prose is measuring the inference.
 */

const replySchema = z.object({
  verdict: z.string().optional(),
  // Some agents name the field for the act rather than the judgement.
  decision: z.string().optional(),
  reasoning: z.string().optional(),
  action: z.string().nullish(),
  actionName: z.string().nullish(),
  amount: z.number().nullish(),
});

/*
 * A small, explicit table. Not an attempt to understand free text: a word
 * outside this list is an error, because the alternative is LACUNA deciding
 * the case on the agent's behalf and then grading its own answer.
 */
const VERDICTS: Record<string, "allow" | "deny" | "escalate"> = {
  allow: "allow",
  allowed: "allow",
  approve: "allow",
  approved: "allow",
  accept: "allow",
  accepted: "allow",
  deny: "deny",
  denied: "deny",
  refuse: "deny",
  refused: "deny",
  reject: "deny",
  rejected: "deny",
  block: "deny",
  blocked: "deny",
  escalate: "escalate",
  escalated: "escalate",
  defer: "escalate",
  deferred: "escalate",
  ask: "escalate",
  review: "escalate",
};

export function normaliseVerdict(raw: string | undefined): "allow" | "deny" | "escalate" | null {
  if (raw === undefined) return null;
  return VERDICTS[raw.trim().toLowerCase()] ?? null;
}

export interface ParsedReply {
  verdict: "allow" | "deny" | "escalate";
  reasoning: string;
  actionName: string | null;
  amount: number | null;
}

export type ParseResult = { ok: true; value: ParsedReply } | { ok: false; why: string };

export function parseDecision(body: unknown): ParseResult {
  const shape = replySchema.safeParse(body);
  if (!shape.success) return { ok: false, why: "the reply was not an object with a verdict" };

  const verdict = normaliseVerdict(shape.data.verdict ?? shape.data.decision);
  if (verdict === null) {
    const got = shape.data.verdict ?? shape.data.decision;
    return {
      ok: false,
      why:
        got === undefined
          ? "the reply carried no verdict field"
          : `"${String(got).slice(0, 40)}" is not a verdict this adapter recognises`,
    };
  }

  const action = shape.data.action ?? shape.data.actionName ?? null;

  return {
    ok: true,
    value: {
      verdict,
      reasoning: shape.data.reasoning ?? "",
      actionName: action !== null && action.length > 0 ? action : null,
      amount: shape.data.amount ?? null,
    },
  };
}

/*
 * The arena runs on a public server. Without this, handing it a target URL
 * turns it into an open proxy into whatever is reachable from that host,
 * including cloud metadata at 169.254.169.254.
 *
 * This blocks at lookup time. A hostname that resolves differently on the
 * second connection could still slip past, which is a real limit rather than
 * one worth pretending away, but it needs a deliberate rebinding attack
 * rather than a pasted URL.
 */
export function isPrivateAddress(address: string): boolean {
  const v = isIP(address);

  if (v === 4) {
    const parts = address.split(".").map(Number);
    const [a = 0, b = 0] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier NAT
    return false;
  }

  if (v === 6) {
    const a = address.toLowerCase();
    if (a === "::" || a === "::1") return true;
    if (a.startsWith("fe80") || a.startsWith("fc") || a.startsWith("fd")) return true;
    // IPv4 written as IPv6, which otherwise walks straight past the checks.
    const mapped = a.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }

  return false;
}

export class TargetUrlError extends Error {}

export async function assertReachableTarget(raw: string, allowPrivate: boolean): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TargetUrlError(`"${raw}" is not a URL`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TargetUrlError(`${url.protocol} is not a protocol this adapter will call`);
  }

  if (allowPrivate) return url;

  const literal = isIP(url.hostname) !== 0;
  const addresses = literal
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true }).catch(() => {
        throw new TargetUrlError(`${url.hostname} did not resolve`);
      });

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new TargetUrlError(
        `${url.hostname} resolves to ${address}, which is on a private network. ` +
          `Set LACUNA_ALLOW_PRIVATE_TARGETS=1 to audit an agent on this machine.`,
      );
    }
  }

  return url;
}

export interface HttpTargetOptions {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  // Hand the agent its policy on every call. Off by default: a deployed agent
  // should already hold it, and sending it measures our prompt, not theirs.
  sendPolicy?: boolean;
  allowPrivate?: boolean;
}

export function httpTarget(options: HttpTargetOptions): Target {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const allowPrivate =
    options.allowPrivate ?? process.env["LACUNA_ALLOW_PRIVATE_TARGETS"] === "1";

  let checked: Promise<URL> | undefined;
  const resolveUrl = () => (checked ??= assertReachableTarget(options.url, allowPrivate));

  const failed = (attack: AttackCase, why: string, latencyMs: number): Decision => ({
    caseId: attack.id,
    verdict: "error",
    reasoning: why.slice(0, 300),
    actionName: null,
    amount: null,
    latencyMs,
  });

  return {
    describe: { kind: "http", url: options.url, model: null },

    async decide(policy: CompiledPolicy, attack: AttackCase): Promise<Decision> {
      const started = Date.now();
      const since = () => Date.now() - started;

      let url: URL;
      try {
        url = await resolveUrl();
      } catch (error) {
        return failed(attack, error instanceof Error ? error.message : String(error), since());
      }

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", ...options.headers },
          body: JSON.stringify({
            caseId: attack.id,
            scenario: attack.scenario,
            request: attack.request,
            ...(options.sendPolicy ? { policy: policy.text } : {}),
          }),
          signal: abort.signal,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          return failed(
            attack,
            `the agent answered ${response.status}: ${detail.slice(0, 160)}`,
            since(),
          );
        }

        const body: unknown = await response.json().catch(() => null);
        const parsed = parseDecision(body);
        if (!parsed.ok) return failed(attack, parsed.why, since());

        return { caseId: attack.id, ...parsed.value, latencyMs: since() };
      } catch (error) {
        const why =
          error instanceof Error && error.name === "AbortError"
            ? `the agent did not answer within ${timeoutMs}ms`
            : error instanceof Error
              ? error.message
              : String(error);
        return failed(attack, why, since());
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
