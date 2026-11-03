export interface Step {
  stage: string;
  detail: string;
  at: number;
}

function clock(at: number): string {
  const d = new Date(at);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(
    d.getMilliseconds(),
    3,
  )}`;
}

function Lines({ steps, running }: { steps: Step[]; running: boolean }) {
  return (
    <div className="procedure" data-running={running}>
      <ol>
        {steps.map((s, i) => (
          <li key={`${s.at}-${i}`}>
            <span className="at">{clock(s.at)}</span>
            <span className="stage">{s.stage}</span>
            <span className="detail">
              {s.detail}
              {running && i === steps.length - 1 ? <span className="caret" /> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Telemetry({ steps, running }: { steps: Step[]; running: boolean }) {
  if (steps.length === 0) return null;

  if (running) return <Lines steps={steps} running />;

  const first = steps[0]?.at ?? 0;
  const last = steps[steps.length - 1]?.at ?? first;
  const seconds = ((last - first) / 1000).toFixed(1);

  // Kept rather than discarded: the reader should be able to see what was
  // done, not just what was concluded.
  return (
    <details className="procedure-record">
      <summary>
        procedure &#183; {steps.length} steps &#183; {seconds}s
      </summary>
      <Lines steps={steps} running={false} />
    </details>
  );
}
