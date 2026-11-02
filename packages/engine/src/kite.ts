import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// Kite enforces the limits that can be counted: amount per transaction, total
// budget, asset, endpoint scope. Everything it refuses carries one of these
// codes. What it cannot enforce is whether the spend was the right one, which
// is the gap this tool exists to measure.
export const SESSION_ERRORS = [
  "session_rule_exceeded",
  "session_total_exceeded",
  "session_endpoint_forbidden",
  "session_asset_forbidden",
  "session_forbidden",
  "session_owner_forbidden",
  "payment_target_forbidden",
  "payment_redirect_not_allowed",
  "session_request_forbidden",
] as const;

export type SessionError = (typeof SESSION_ERRORS)[number];

export type KiteFailure =
  | { kind: "refused"; code: SessionError; hint: string; raw: unknown }
  | { kind: "cli_missing"; message: string }
  | { kind: "error"; message: string; raw: unknown };

export type KiteResult<T> = { ok: true; value: T } | ({ ok: false } & KiteFailure);

export interface SessionLimits {
  taskSummary: string;
  maxAmountPerTx: number;
  maxTotalAmount: number;
  ttl: string;
  assets: string[];
}

// Every failure shape rendered one way, so callers never narrow by hand.
export function describeFailure(f: KiteFailure): string {
  switch (f.kind) {
    case "refused":
      return f.hint.length > 0 ? `${f.code}: ${f.hint}` : f.code;
    case "cli_missing":
      return f.message;
    case "error":
      return f.message;
  }
}

export function kpassPath(): string | undefined {
  const local = join(homedir(), ".kpass", "bin", "kpass");
  if (existsSync(local)) return local;
  const linked = join(homedir(), ".local", "bin", "kpass");
  if (existsSync(linked)) return linked;
  return undefined;
}

// Every call is non-interactive and JSON, which is what Kite documents as the
// automation path. Arguments go as an array so nothing reaches a shell.
export function buildArgs(command: string[]): string[] {
  return [...command, "--output", "json", "--no-interactive"];
}

export function classifyFailure(payload: unknown): KiteFailure {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});

  for (const code of SESSION_ERRORS) {
    if (text.includes(code)) {
      const hint =
        (payload as { hint?: string } | null)?.hint ??
        (payload as { error?: { hint?: string } } | null)?.error?.hint ??
        "";
      return { kind: "refused", code, hint, raw: payload };
    }
  }
  return { kind: "error", message: text.slice(0, 400), raw: payload };
}

function parseJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    // Some commands print a human line before the JSON body.
    const start = stdout.indexOf("{");
    const end = stdout.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stdout.slice(start, end + 1));
      } catch {
        return { raw: stdout };
      }
    }
    return { raw: stdout };
  }
}

export async function kpass(command: string[]): Promise<KiteResult<unknown>> {
  const bin = kpassPath();
  if (!bin) {
    return {
      ok: false,
      kind: "cli_missing",
      message: "kpass is not installed; run the Kite Passport installer first",
    };
  }

  try {
    const { stdout } = await run(bin, buildArgs(command), {
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { ok: true, value: parseJson(stdout) };
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout ?? "";
    const stderr = (err as { stderr?: string }).stderr ?? "";
    const body = stdout.trim().length > 0 ? parseJson(stdout) : stderr || String(err);
    return { ok: false, ...classifyFailure(body) };
  }
}

export const kite = {
  status: () => kpass(["status"]),
  health: () => kpass(["health"]),
  me: () => kpass(["me"]),
  walletBalance: () => kpass(["wallet", "balance"]),
  listAgents: () => kpass(["user", "agents"]),

  registerAgent: (type = "coding-assistant") => kpass(["agent:register", "--type", type]),

  createSession: (limits: SessionLimits) =>
    kpass([
      "agent:session",
      "create",
      "--task-summary",
      limits.taskSummary,
      "--max-amount-per-tx",
      String(limits.maxAmountPerTx),
      "--max-total-amount",
      String(limits.maxTotalAmount),
      "--ttl",
      limits.ttl,
      "--assets",
      limits.assets.join(","),
      "--payment-approach",
      "x402_http",
    ]),

  // Blocks until the human approves or declines, which is the point of the
  // passkey step rather than an obstacle to it.
  awaitApproval: (requestId: string) =>
    kpass(["agent:session", "status", "--request-id", requestId, "--wait"]),

  activeSessions: () => kpass(["agent:session", "list", "--status", "active"]),

  execute: (url: string, method = "GET") =>
    kpass(["agent:session", "execute", "--url", url, "--method", method]),
};
