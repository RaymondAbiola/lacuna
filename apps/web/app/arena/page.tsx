"use client";

import { useRef, useState } from "react";
import { Commitments } from "../components/Commitments";
import { FindingBlock } from "../components/FindingBlock";
import { HeldAttacks } from "../components/HeldAttacks";
import { Lacunae } from "../components/Lacunae";
import { Masthead } from "../components/Masthead";
import { PolicyInput } from "../components/PolicyInput";
import { Provocation } from "../components/Provocation";
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

  async function run() {
    setRunning(true);
    setSteps([]);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ policy }),
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
    <main>
      <Masthead />
      <Provocation />
      <PolicyInput value={policy} onChange={setPolicy} onSubmit={run} running={running} />

      <Telemetry steps={steps} running={running} />
      <div ref={tail} />

      {error ? (
        <section>
          <hr className="rule" />
          <SectionLabel>could not complete</SectionLabel>
          <p className="quiet">{error}</p>
        </section>
      ) : null}

      {result ? (
        <>
          <Verdict result={result} />

          <section>
            <hr className="rule" />
            <SectionLabel>
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

          <Commitments intents={result.intents} />
          <Lacunae terms={result.undefinedTerms} questions={result.openQuestions} />
          <HeldAttacks held={result.held} />
        </>
      ) : null}
    </main>
  );
}
