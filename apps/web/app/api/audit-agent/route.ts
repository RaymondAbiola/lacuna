import { audit, httpTarget, type AuditResult } from "@lacuna/engine";
import { containment } from "@lacuna/core";
import { checkGuard, clientIp, recordRun } from "../audit/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
 * Audits the deployed reference agent, live.
 *
 * The target is fixed, read from the environment, and never taken from the
 * request. That is deliberate: accepting a URL here would turn this public
 * server into an open proxy into whatever it can reach, and the only thing
 * this endpoint is for is auditing our own agent.
 *
 * The agent declares both its policy and the caps its host enforces. Lacuna
 * takes both, so a finding can be sorted by whether anything outside the
 * wording would have stopped it.
 */

/*
 * Render's fromService hands over a bare hostname, not a URL, and a bare
 * hostname is not something the http target will call. Normalised here so the
 * blueprint can stay declarative.
 */
function agentUrl(): string {
  const raw = (process.env["LACUNA_AGENT_URL"] ?? "").trim().replace(/\/+$/, "");
  if (raw.length === 0) return "";
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

const AGENT_URL = agentUrl();

interface Declared {
  policy: string;
  hardLimits: Record<string, number>;
  limits: {
    sessionId: string | null;
    backend: string | null;
    source: string;
    perTransaction: number | null;
    perSession: number | null;
  };
}

type Event =
  | { type: "stage"; stage: string; detail: string }
  | { type: "agent"; declared: Declared }
  | { type: "done"; result: unknown }
  | { type: "error"; message: string };

function split(result: AuditResult, hardLimits: Record<string, number>) {
  return result.findings.map((f) => ({
    id: f.id,
    kind: f.kind,
    severity: f.severity,
    family: f.evidence.case.family,
    summary: f.summary,
    adjudication: f.adjudication,
    implicatedText: f.implicatedText,
    scenario: f.evidence.case.scenario,
    request: f.evidence.case.request,
    verdict: f.evidence.decision.verdict,
    amount: f.evidence.decision.amount,
    reasoning: f.evidence.decision.reasoning,
    // The point of the whole exercise: would anything other than the words
    // have stopped this?
    containment: containment(f, hardLimits),
  }));
}

export async function POST(request: Request): Promise<Response> {
  if (AGENT_URL.length === 0) {
    return Response.json(
      { error: "no reference agent is configured for this deployment" },
      { status: 503 },
    );
  }

  const ip = clientIp(request);
  const allowed = checkGuard(ip);
  if (!allowed.ok) {
    return Response.json(
      { error: allowed.why },
      {
        status: 429,
        headers: allowed.retryAfterSeconds
          ? { "retry-after": String(allowed.retryAfterSeconds) }
          : {},
      },
    );
  }
  recordRun(ip);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Event) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        send({ type: "stage", stage: "agent", detail: "asking the agent what it runs under" });

        /*
         * Generous, because the agent is on a free instance that sleeps after
         * fifteen minutes idle. A cold start can take most of a minute, and
         * the first judge of the day should not be the one who sees it fail.
         */
        const response = await fetch(`${AGENT_URL}/limits`, {
          signal: AbortSignal.timeout(90_000),
        });
        if (!response.ok) throw new Error(`the agent answered ${response.status} at /limits`);
        const declared = (await response.json()) as Declared;

        send({ type: "agent", declared });

        const result = await audit(declared.policy, {
          dbPath: process.env["LACUNA_DB"] ?? "/tmp/lacuna.sqlite",
          target: httpTarget({ url: `${AGENT_URL}/decide`, timeoutMs: 60_000 }),
          hardLimits: declared.hardLimits,
          // Two samples, as everywhere else. An agent that refuses once and
          // allows on the retry has not held, and one sample is maximally
          // likely to catch it in a timid mood.
          samples: 2,
          perFamily: 2,
          onProgress: (stage, detail) => send({ type: "stage", stage, detail }),
        });

        send({
          type: "done",
          result: {
            runId: result.runId,
            score: result.score,
            containment: result.containment,
            inconclusive: result.inconclusive,
            findings: split(result, declared.hardLimits),
            held: result.triaged.flatMap((t, i) => {
              if (t.candidate) return [];
              const c = result.cases[i];
              return c ? [{ id: c.id, family: c.family, why: t.held }] : [];
            }),
          },
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "the agent audit failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
