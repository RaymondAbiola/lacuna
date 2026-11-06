"use client";

import { useRef, useState } from "react";
import { Commitments } from "../components/Commitments";
import { FindingBlock } from "../components/FindingBlock";
import { HeldAttacks } from "../components/HeldAttacks";
import { LiveAgent } from "../components/LiveAgent";
import { Lacunae } from "../components/Lacunae";
import { SiteHeader } from "../components/SiteHeader";
import { PolicyInput } from "../components/PolicyInput";
import { Provocation } from "../components/Provocation";
import { Replay } from "../components/Replay";
import { SectionLabel } from "../components/SectionLabel";
import { Telemetry, type Step } from "../components/Telemetry";
import type { Result } from "../components/types";
import { Verdict } from "../components/Verdict";

export default function Arena() {
  const [policy, setPolicy] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const tail = useRef<HTMLDivElement>(null);

  // The id of the run whose attacks we would reuse. Kept separately from the
  // result so editing the policy and re-running still points at the right one.
  const [lastRun, setLastRun] = useState<string | null>(null);

  async function run(replayFrom?: string) {
    setRunning(true);
    setSteps([]);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(replayFrom ? { policy, replayFrom } : { policy }),
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `the audit failed (${res.status})`);
        return;
      }

      // Newline-delimited JSON, read as it arrives so the procedure appears
      // live rather than after a minute of silence.
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
            | { type: "done"; result: Result }
            | { type: "error"; message: string };

          if (event.type === "stage") {
            setSteps((l) => [...l, { stage: event.stage, detail: event.detail, at: Date.now() }]);
            tail.current?.scrollIntoView({ block: "nearest" });
          } else if (event.type === "done") {
            setResult(event.result);
            setLastRun(event.result.runId);
          } else {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "the audit failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <SiteHeader arena />
      <main id="main" className="arena-main">
        <div className="arena-workbench">
          <Provocation />
          <PolicyInput value={policy} onChange={setPolicy} onSubmit={() => void run()} running={running} />
        </div>

        <Telemetry steps={steps} running={running} />
        <div ref={tail} />

        {!running && !result ? <LiveAgent /> : null}

        {error ? (
          <section className="audit-error" role="alert">
            <hr className="rule" />
            <SectionLabel>could not complete</SectionLabel>
            <p className="quiet">{error}</p>
          </section>
        ) : null}

        {result ? (
          <div className="audit-report">
            <aside className="report-index">
              <p className="label">The examination</p>
              <p className="report-run">Run {result.runId.slice(0, 8)}</p>
              <nav aria-label="Report sections">
                <a href="#report-verdict">Overview <span aria-hidden="true">↗</span></a>
                <a href="#report-findings">Findings <span>{result.findings.length}</span></a>
                {result.intents.length > 0 ? <a href="#report-commitments">Commitments <span>{result.intents.length}</span></a> : null}
                {result.undefinedTerms.length > 0 || result.openQuestions.length > 0 ? <a href="#report-terms">Undefined &amp; open <span aria-hidden="true">↗</span></a> : null}
                {result.held.length > 0 ? <a href="#report-held">Held attacks <span>{result.held.length}</span></a> : null}
              </nav>
            </aside>
            <div className="report-body">
            <div id="report-verdict"><Verdict result={result} /></div>

            <Replay
              delta={result.replayDelta ?? null}
              replayedFrom={result.replayedFrom ?? null}
              running={running}
              onReplay={() => void run(lastRun ?? undefined)}
            />

            <section id="report-findings">
              <hr className="rule" />
              <SectionLabel as="h2">
                findings &#183; {result.findings.length}
              </SectionLabel>
              {result.findings.length === 0 ? (
                <p className="quiet">
                  {result.inconclusive.inconclusive
                    ? "None, but see the note above: nothing was exercised."
                    : "None. Every attack that reached a commitment was refused or escalated."}
                </p>
              ) : null}
              {result.findings.map((f, i) => (
                <FindingBlock key={f.id} finding={f} index={i} />
              ))}
            </section>

            <Replay
              delta={result.replayDelta ?? null}
              replayedFrom={result.replayedFrom ?? null}
              running={running}
              onReplay={() => void run(lastRun ?? undefined)}
              compact
            />

            <div id="report-commitments"><Commitments intents={result.intents} /></div>
            <div id="report-terms"><Lacunae terms={result.undefinedTerms} questions={result.openQuestions} /></div>
            <div id="report-held"><HeldAttacks held={result.held} /></div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
