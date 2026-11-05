import { audit, type AuditResult } from "@lacuna/engine";
import { checkGuard, clientIp, recordRun } from "./guard";

export const runtime = "nodejs";
// An audit takes tens of seconds, so the route must not be cached or cut short.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_POLICY_CHARS = 4000;

// Streamed as newline-delimited JSON rather than returned at the end. An
// audit takes 30 to 60 seconds and a judge watching a spinner for a minute
// assumes it is broken, so each stage is reported as it happens.
type Event =
  | { type: "stage"; stage: string; detail: string }
  | { type: "done"; result: PublicResult }
  | { type: "error"; message: string };

interface PublicResult {
  runId: string;
  replayedFrom: string | null;
  replayDelta: AuditResult["replayDelta"] | null;
  score: AuditResult["score"];
  inconclusive: AuditResult["inconclusive"];
  intents: { id: string; statement: string; disposition: string; stated: boolean; breached: boolean }[];
  undefinedTerms: { term: string; why: string }[];
  openQuestions: string[];
  findings: {
    id: string;
    kind: string;
    severity: string;
    summary: string;
    adjudication: string;
    implicatedText: string[];
    scenario: string;
    request: string;
    verdict: string;
    amount: number | null;
    reasoning: string;
  }[];
  held: { id: string; family: string; why: string }[];
}

function toPublic(result: AuditResult): PublicResult {
  const breached = new Set(result.findings.flatMap((f) => f.breaches));

  return {
    runId: result.runId,
    replayedFrom: result.replayedFrom ?? null,
    replayDelta: result.replayDelta ?? null,
    score: result.score,
    inconclusive: result.inconclusive,
    intents: result.policy.intents.map((i) => ({
      id: i.id,
      statement: i.statement,
      disposition: i.disposition,
      stated: i.sourceClauses.length > 0,
      breached: breached.has(i.id),
    })),
    undefinedTerms: result.policy.undefinedTerms.map((t) => ({ term: t.term, why: t.why })),
    openQuestions: result.policy.openQuestions,
    findings: result.findings.map((f) => ({
      id: f.id,
      kind: f.kind,
      severity: f.severity,
      summary: f.summary,
      adjudication: f.adjudication,
      implicatedText: f.implicatedText,
      scenario: f.evidence.case.scenario,
      request: f.evidence.case.request,
      verdict: f.evidence.decision.verdict,
      amount: f.evidence.decision.amount,
      reasoning: f.evidence.decision.reasoning,
    })),
    held: result.triaged.flatMap((t, i) => {
      if (t.candidate) return [];
      const c = result.cases[i];
      return c ? [{ id: c.id, family: c.family, why: t.held }] : [];
    }),
  };
}

export async function POST(request: Request): Promise<Response> {
  let text: string;
  let replayFrom: string | undefined;
  try {
    const body = (await request.json()) as { policy?: unknown; replayFrom?: unknown };
    text = typeof body.policy === "string" ? body.policy.trim() : "";
    // A run id, so the same attacks can be put to edited wording. Only ids
    // this store wrote will resolve, so nothing useful can be smuggled in.
    replayFrom = typeof body.replayFrom === "string" ? body.replayFrom.trim() : undefined;
  } catch {
    return Response.json({ error: "send JSON with a policy field" }, { status: 400 });
  }

  if (text.length === 0) {
    return Response.json({ error: "write a rule first" }, { status: 400 });
  }
  if (text.length > MAX_POLICY_CHARS) {
    return Response.json(
      { error: `keep it under ${MAX_POLICY_CHARS} characters` },
      { status: 413 },
    );
  }

  // Checked before anything is spent, and only counted once a run begins.
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
        const result = await audit(text, {
          dbPath: process.env["LACUNA_DB"] ?? "/tmp/lacuna.sqlite",
          // Three samples, and the eager persona. A cautious agent escalates
          // whenever the wording runs out, which makes every policy look
          // sound and hides the gaps worth finding. The honest question is
          // whether the wording holds against an agent that wants to say yes,
          // and one sample is maximally likely to catch it in a timid mood.
          samples: 2,
          persona: "eager",
          // Thorough coverage matters more than a short run: a judge who gets
          // no findings because the generator stopped early learns nothing.
          perFamily: 4,
          ...(replayFrom ? { replayFrom } : {}),
          onProgress: (stage, detail) => send({ type: "stage", stage, detail }),
        });
        send({ type: "done", result: toPublic(result) });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "the audit failed",
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
