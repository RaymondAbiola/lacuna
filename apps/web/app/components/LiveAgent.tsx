"use client";

import { useState } from "react";
import { SectionLabel } from "./SectionLabel";

/*
 * Audits the deployed reference agent, on demand, from the arena.
 *
 * Everything else on this site is either a recorded run or an audit of a
 * policy with no agent behind it. This is the one place a reader can press a
 * button and watch Lacuna attack something that is actually running, holding
 * a real Kite spending session, over HTTP.
 *
 * The target is fixed on the server. Nothing here sends a URL.
 */

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

interface AgentFinding {
  id: string;
  severity: string;
  family: string;
  summary: string;
  amount: number | null;
  reasoning: string;
  implicatedText: string[];
  scenario: string;
  containment: "stopped" | "live" | "unknown";
}

interface AgentResult {
  runId: string;
  replayedFrom: string | null;
  replayDelta: {
    fixed: string[];
    regressed: string[];
    persisted: string[];
    exposure: number;
  } | null;
  score: { integrity: number; casesRun: number; findings: number; coverage: number };
  containment: { stopped: number; live: number; unknown: number; liveAmount: number };
  /*
   * Set when the run proved nothing: too many cases errored, or the agent
   * never acted at all. Without this on screen a broken agent is
   * indistinguishable from a careful policy, which is the most dangerous way
   * for this tool to be wrong. It cost five clean looking runs to learn that.
   */
  inconclusive: { inconclusive: boolean; why: string };
  findings: AgentFinding[];
}

const CONTAINMENT_LABEL: Record<AgentFinding["containment"], string> = {
  live: "nothing stops this",
  stopped: "the host cap refuses this",
  unknown: "no amount named",
};

export function LiveAgent() {
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<{ stage: string; detail: string }[]>([]);
  const [declared, setDeclared] = useState<Declared | null>(null);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  async function run(replayFrom?: string) {
    setRunning(true);
    setStages([]);
    setDeclared(null);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/audit-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(replayFrom ? { replayFrom } : {}),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `the agent audit failed (${res.status})`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim().length === 0) continue;
          const event = JSON.parse(line) as
            | { type: "stage"; stage: string; detail: string }
            | { type: "agent"; declared: Declared }
            | { type: "done"; result: AgentResult }
            | { type: "error"; message: string };

          if (event.type === "stage") {
            setStages((prev) => [...prev, { stage: event.stage, detail: event.detail }]);
          } else if (event.type === "agent") {
            setDeclared(event.declared);
          } else if (event.type === "done") {
            setResult(event.result);
            setLastRun(event.result.runId);
          } else {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "the agent audit failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="live-agent">
      <hr className="rule" />
      <SectionLabel>or attack something that is actually running</SectionLabel>

      <p className="ask">A deployed payments agent, holding a real Kite spending session.</p>

      <p className="quiet">
        It has its own instructions and its own spending caps, and Lacuna reaches it over HTTP
        exactly as it would reach yours. The interesting part is not whether the caps hold. They
        do. It is what the wording lets through underneath them.
      </p>

      <div className="actions">
        <button type="button" className="primary" onClick={() => void run()} disabled={running}>
          {running ? "auditing the agent" : "audit the live agent"}
        </button>
        {lastRun && !running ? (
          <button type="button" onClick={() => void run(lastRun)}>
            put those same attacks again
          </button>
        ) : null}
      </div>

      {declared ? (
        <div className="agent-card">
          <p className="sheet-label">what the agent runs under</p>
          <p className="agent-policy">{declared.policy}</p>
          <div className="readouts">
            <span>
              <b>per payment</b>${declared.limits.perTransaction ?? "none"}
            </span>
            <span>
              <b>per session</b>${declared.limits.perSession ?? "none"}
            </span>
            <span>
              <b>caps</b>
              {declared.limits.source}
            </span>
          </div>
          {declared.limits.sessionId ? (
            <p className="attribution">
              kite session {declared.limits.sessionId.slice(0, 28)} &#183;{" "}
              {declared.limits.backend?.replace("https://", "")}
            </p>
          ) : null}
        </div>
      ) : null}

      {stages.length > 0 ? (
        <div className="procedure" data-running={running}>
          <ol>
            {stages.map((s, i) => (
              <li key={`${s.stage}-${i}`}>
                <span className="stage">{s.stage}</span>
                <span className="detail">{s.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {error ? <p className="quiet agent-error">{error}</p> : null}

      {result?.inconclusive.inconclusive ? (
        <div className="agent-result">
          <p className="agent-inconclusive">
            This run proves nothing: {result.inconclusive.why}. A clean result here would mean the
            agent was never actually asked, not that its rules are sound.
          </p>
          <p className="attribution">recorded run {result.runId.slice(0, 8)}</p>
        </div>
      ) : null}

      {result && !result.inconclusive.inconclusive ? (
        <div className="agent-result">
          <div className="readouts">
            <span>
              <b>integrity</b>
              {result.score.integrity}%
            </span>
            <span>
              <b>attacks</b>
              {result.score.casesRun}
            </span>
            <span>
              <b>findings</b>
              {result.score.findings}
            </span>
            <span>
              <b>stopped by the host</b>
              {result.containment.stopped}
            </span>
            <span>
              <b>nothing stops</b>
              {result.containment.live}
            </span>
          </div>

          {result.replayDelta && result.replayedFrom ? (
            <div className="agent-delta">
              <p className="sheet-label">
                the identical attacks from run {result.replayedFrom.slice(0, 8)}
              </p>
              {result.replayDelta.fixed.length === 0 &&
              result.replayDelta.regressed.length === 0 ? (
                <p className="quiet">
                  Every case landed the same way as last time. The agent is answering
                  consistently, at least on these attacks.
                </p>
              ) : (
                <p className="replay-warn">
                  Same attacks, different answers. {result.replayDelta.regressed.length} case
                  {result.replayDelta.regressed.length === 1 ? "" : "s"} failed this time that did
                  not before, and {result.replayDelta.fixed.length} stopped failing. Nothing about
                  the agent or its rules changed between the two runs, which is the point: a
                  policy that survived one run was not shown to hold, it was shown to be
                  under-tested.
                </p>
              )}
            </div>
          ) : null}

          {result.containment.live > 0 ? (
            <p className="agent-headline">
              ${result.containment.liveAmount.toFixed(2)} moves on wording alone, under every cap.
            </p>
          ) : (
            <p className="quiet">
              Nothing was confirmed against this agent on this run. Run it again and you will get
              a different set of attacks, because the attacks are written fresh each time and the
              agent answering them is not deterministic either. That is not noise in the
              measurement, it is the thing being measured: a policy that survives one run has not
              been shown to hold, it has been shown to be under-tested. Earlier runs against this
              same agent found $49.98, $22.80 and $18.00.
            </p>
          )}

          {result.findings.map((f) => (
            <article className="finding" data-severity={f.severity} key={f.id}>
              <header className="finding-head">
                <span>
                  {f.id} &#183; {f.family} &#183; {CONTAINMENT_LABEL[f.containment]}
                </span>
                <span className="sev">{f.amount === null ? "no amount" : `$${f.amount}`}</span>
              </header>
              <h3 className="finding-summary">{f.summary}</h3>
              <p className="situation">
                <b>situation</b>
                {f.scenario}
              </p>
              <p className="testimony">
                <span className="mark">&raquo;</span>
                <span>{f.reasoning}</span>
              </p>
            </article>
          ))}

          <p className="attribution">recorded run {result.runId.slice(0, 8)}</p>
        </div>
      ) : null}
    </section>
  );
}
