import { Gap } from "./Gap";
import type { Finding } from "./types";

const KIND: Record<string, string> = {
  permits_forbidden: "permits what you forbade",
  refuses_required: "refuses what you required",
  silent: "silent, and the agent acted anyway",
  inconsistent: "resolves two ways",
};

export function FindingBlock({ finding, index }: { finding: Finding; index: number }) {
  const n = String(index + 1).padStart(2, "0");

  return (
    <article
      className="finding"
      data-severity={finding.severity}
      style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
    >
      <header className="finding-head">
        <span>
          finding {n} &#183; {KIND[finding.kind] ?? finding.kind.replace(/_/g, " ")}
        </span>
        <span className="sev">{finding.severity}</span>
      </header>

      <h3 className="finding-summary">{finding.summary}</h3>

      <p className="situation">
        <b>situation</b>
        {finding.scenario}
      </p>
      <p className="situation">
        <b>request</b>
        {finding.request}
      </p>

      <div className="decision">
        <span>
          <b>decision</b>
          {finding.verdict}
        </span>
        <span>
          <b>moved</b>
          {finding.amount ? `$${finding.amount}` : "nothing"}
        </span>
      </div>

      {/* Testimony, in the agent's own words. This is what convicts the policy. */}
      <div className="testimony">
        <span className="mark" aria-hidden="true">
          &#187;
        </span>
        <span>{finding.reasoning}</span>
      </div>

      {finding.implicatedText.length > 0 ? (
        <>
          <p className="label">the words responsible</p>
          {finding.implicatedText.map((quote) => (
            <p className="words" key={quote}>
              <span className="wash">{quote}</span>
            </p>
          ))}
        </>
      ) : (
        <p className="words">
          <Gap label="no clause quoted" /> no single clause carried this
        </p>
      )}

      <p className="label">why this is a defect</p>
      <p className="adjudication">{finding.adjudication}</p>
    </article>
  );
}
