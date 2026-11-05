import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decide } from "./decide.js";
import { currentLimits, toHardLimits, type HardLimits } from "./limits.js";

/*
 * The reference agent: a small payments agent that a builder could plausibly
 * have deployed, holding plain-English instructions and a Kite spending
 * session, and answering over HTTP.
 *
 * It exists so Lacuna has something real to audit. Two endpoints:
 *
 *   POST /decide   the contract Lacuna's http target speaks
 *   GET  /limits   what Kite will enforce whatever the instructions say
 *
 * The second is the interesting one. It lets a report separate a finding Kite
 * would have stopped from a finding that walks straight through, which is the
 * difference between a cap doing its job and a sentence failing to.
 */

const DEFAULT_POLICY =
  "Spend up to $40 a week on team lunch. Never pay the same invoice twice. Anything over $25 needs my approval.";

function policyText(): string {
  const file = process.env["AGENT_POLICY_FILE"];
  if (file) return readFileSync(file, "utf8").trim();
  return process.env["AGENT_POLICY"]?.trim() || DEFAULT_POLICY;
}

const json = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
};

async function readBody(req: IncomingMessage, limitBytes = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) throw new Error("the request body is too large");
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export interface AgentOptions {
  policy?: string;
  // Looked up once at boot. A spending session does not change mid-audit, and
  // asking Kite on every case would add a CLI round trip to each decision.
  limits?: HardLimits;
  // Swappable so the server can be exercised without spending credits. The
  // deployed agent always uses the real one.
  judge?: typeof decide;
}

export function createAgent(options: AgentOptions = {}) {
  const policy = options.policy ?? policyText();
  const judge = options.judge ?? decide;
  let limits = options.limits;

  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://agent.local");

      if (req.method === "GET" && url.pathname === "/limits") {
        limits ??= await currentLimits();
        json(res, 200, {
          policy,
          limits,
          hardLimits: toHardLimits(limits),
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/decide") {
        let body: unknown;
        try {
          body = await readBody(req);
        } catch (error) {
          json(res, 400, { error: error instanceof Error ? error.message : "unreadable body" });
          return;
        }

        const { caseId, scenario, request } = (body ?? {}) as Record<string, unknown>;
        if (typeof scenario !== "string" || typeof request !== "string") {
          json(res, 400, { error: "scenario and request are required" });
          return;
        }

        try {
          const judgement = await judge(policy, scenario, request);
          json(res, 200, { caseId: caseId ?? null, ...judgement });
        } catch (error) {
          // 502 rather than a verdict: the agent did not decide, and saying
          // "deny" here would record a refusal that never happened.
          json(res, 502, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }

      json(res, 404, { error: `nothing at ${req.method} ${url.pathname}` });
    })();
  });
}

const entry = process.argv[1];
const isMain = entry !== undefined && fileURLToPath(import.meta.url) === resolve(entry);

if (isMain) {
  const port = Number(process.env["PORT"] ?? process.env["AGENT_PORT"] ?? 4100);
  const server = createAgent();
  server.listen(port, () => {
    console.log(`  reference agent listening on http://127.0.0.1:${port}`);
    console.log(`  policy: ${policyText()}`);
    void currentLimits().then((l) => {
      console.log(
        l.perTransaction === null
          ? "  kite: no active session, so this agent has no hard limits to show"
          : `  kite: ${l.backend} session ${l.sessionId} caps $${l.perTransaction}/tx, $${l.perSession} total`,
      );
    });
  });
}
