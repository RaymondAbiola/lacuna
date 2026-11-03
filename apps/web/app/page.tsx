"use client";

import { useRef, useState } from "react";
import { EXAMPLES } from "./examples";

interface Finding {
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
}

interface Result {
  runId: string;
  score: {
    casesRun: number;
    findings: number;
    integrity: number;
    coverage: number;
    exposure: number;
    intentsProbed: number;
    intentsBreached: number;
    intentsTotal: number;
  };
  inconclusive: { inconclusive: boolean; why: string };
  intents: { id: string; statement: string; disposition: string; stated: boolean; breached: boolean }[];
  undefinedTerms: { term: string; why: string }[];
  openQuestions: string[];
  findings: Finding[];
  held: { id: string; family: string; why: string }[];
}

export default function Arena() {
  const [policy, setPolicy] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);

  async function run() {
    setRunning(true);
    setLog([]);
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

      // Newline-delimited JSON, read as it arrives so the stages appear live.
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
            setLog((l) => [...l, `${event.stage}: ${event.detail}`]);
            logEnd.current?.scrollIntoView({ block: "nearest" });
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
      <h1>Lacuna</h1>

      <p>
        <strong>Write a spending rule for an AI agent. One sentence is fine.</strong> Lacuna will
        work out what you appear to have promised, attack the wording, and tell you what it
        actually permits.
      </p>

      <p>
        <em>
          Caveat emptor. Buyer beware. Except the buyer is an agent now, and it cannot beware of
          anything, because nobody ever tested the rules you gave it.
        </em>
      </p>

      <p>
        <small>
          Your rules are tested against an agent measured on getting things done, because that is
          the agent they will meet once someone tunes for throughput or upgrades the model. A
          policy that only holds because the agent was timid is not holding.
        </small>
      </p>

      <textarea
        rows={7}
        value={policy}
        onChange={(e) => setPolicy(e.target.value)}
        placeholder="You can spend up to $10 on lunch."
        disabled={running}
        aria-label="Your agent's rules"
      />

      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={run} disabled={running || policy.trim().length === 0}>
          {running ? "attacking..." : "Find the holes"}
        </button>
        <span>or try:</span>
        {EXAMPLES.map((e) => (
          <button key={e.label} onClick={() => setPolicy(e.text)} disabled={running}>
            {e.label}
          </button>
        ))}
      </div>

      {log.length > 0 ? (
        <>
          <hr />
          <pre>{log.join("\n")}</pre>
          <div ref={logEnd} />
        </>
      ) : null}

      {error ? (
        <>
          <hr />
          <p>
            <strong>{error}</strong>
          </p>
        </>
      ) : null}

      {result ? <Report result={result} /> : null}
    </main>
  );
}

function Report({ result }: { result: Result }) {
  const s = result.score;

  return (
    <>
      <hr />

      {result.inconclusive.inconclusive ? (
        <blockquote>
          <strong>Inconclusive.</strong> {result.inconclusive.why}. A clean result here means the
          rules were never exercised, not that they are sound.
        </blockquote>
      ) : null}

      <p>
        <strong>{s.integrity}%</strong> of the commitments put under attack held.{" "}
        {s.intentsBreached} of {s.intentsProbed} were breached, out of {s.intentsTotal} found in
        your wording. {s.casesRun} attacks run, {s.findings} became findings.
      </p>

      <h2>What you appear to have promised</h2>
      <ul>
        {result.intents.map((i) => (
          <li key={i.id}>
            {i.breached ? <strong>breached: </strong> : null}
            {i.statement} <small>({i.disposition}{i.stated ? "" : ", inferred rather than stated"})</small>
          </li>
        ))}
      </ul>

      <h2>Findings ({result.findings.length})</h2>
      {result.findings.length === 0 ? (
        <p>None. Every attack that reached a commitment was refused or escalated.</p>
      ) : null}

      {result.findings.map((f) => (
        <section key={f.id}>
          <h3>
            {f.severity}: {f.summary}
          </h3>
          {f.implicatedText.length > 0 ? (
            <>
              <p>The words responsible:</p>
              {f.implicatedText.map((q) => (
                <blockquote key={q}>{q}</blockquote>
              ))}
            </>
          ) : null}
          <p>
            <strong>Situation.</strong> {f.scenario}
          </p>
          <p>
            <strong>Request.</strong> {f.request}
          </p>
          <p>
            <strong>The agent chose {f.verdict}</strong>
            {f.amount ? ` and would move $${f.amount}` : ""}, reasoning: {f.reasoning}
          </p>
          <p>
            <strong>Why this is a defect.</strong> {f.adjudication}
          </p>
        </section>
      ))}

      {result.undefinedTerms.length > 0 ? (
        <>
          <h2>Terms your rules never define</h2>
          <ul>
            {result.undefinedTerms.map((t) => (
              <li key={t.term}>
                <strong>{t.term}</strong> {t.why}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {result.openQuestions.length > 0 ? (
        <>
          <h2>Questions your rules leave open</h2>
          <ul>
            {result.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      ) : null}

      {result.held.length > 0 ? (
        <>
          <h2>Attacks that did not become findings ({result.held.length})</h2>
          <p>Shown so you can see what was tried, not only what stuck.</p>
          <ul>
            {result.held.map((h) => (
              <li key={h.id}>
                <small>
                  {h.family}: {h.why}
                </small>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
