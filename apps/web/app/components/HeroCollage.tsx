import { Fragment } from "react";

import { showcase } from "../showcase";

/*
 * The evidence, arranged as it would be on a desk: the policy underneath, the
 * charge it failed to govern on top, and the verdict in front. Every number
 * and every quoted word comes from recorded run a081e71c. Nothing here is a
 * mock-up of a result we have not actually produced.
 */

// The group-lunch finding: the clearest of the three, and the one the headline
// number refers to.
const FINDING_ID = "F-L-6";
const HIGHLIGHT = "up to $10";

function trim(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}...`;
}

export function HeroCollage() {
  const finding =
    showcase.findings.find((f) => f.id === FINDING_ID) ?? showcase.findings[0];
  if (!finding) return null;

  const policy = showcase.policyText;
  const at = policy.indexOf(HIGHLIGHT);
  const before = at >= 0 ? policy.slice(0, at) : policy;
  const after = at >= 0 ? policy.slice(at + HIGHLIGHT.length) : "";
  const amount = finding.amount ?? 0;

  // The sentence is written a word at a time, so the reader watches the policy
  // being set down before anything is said against it.
  const words = (text: string) => (text.trim() ? text.trim().split(/\s+/) : []);
  const head = words(before);
  const marked = at >= 0 ? words(HIGHLIGHT) : [];
  const tail = words(after);
  // The headline on the left is on screen from the first frame. The collage
  // holds until it has been read, then sets the sentence down slowly enough
  // to follow.
  const WORD_BASE = 2100;
  const WORD_STEP = 95;
  const delay = (i: number) => ({ animationDelay: `${WORD_BASE + i * WORD_STEP}ms` });

  return (
    <div className="collage" aria-label="The recorded finding, as evidence">
      {/* the policy, underneath everything, because it came first */}
      <article className="sheet sheet--policy">
        <p className="sheet-label">Policy under examination</p>

        {/* The quotation marks ride along with the words they belong to, so a
            lone closing quote can never wrap onto a line of its own. */}
        <p className="policy-quote">
          {head.map((w, i) => (
            <Fragment key={`h${i}`}>
              <span className="pw" style={delay(i)}>
                {i === 0 ? `\u201C${w}` : w}
              </span>{" "}
            </Fragment>
          ))}
          {marked.length > 0 && (
            <mark className="policy-mark">
              {marked.map((w, i) => (
                <Fragment key={`m${i}`}>
                  <span className="pw" style={delay(head.length + i)}>
                    {w}
                  </span>
                  {i < marked.length - 1 ? " " : ""}
                </Fragment>
              ))}
            </mark>
          )}{" "}
          {tail.map((w, i) => (
            <Fragment key={`t${i}`}>
              <span className="pw" style={delay(head.length + marked.length + i)}>
                {i === tail.length - 1 ? `${w}\u201D` : w}
              </span>
              {i < tail.length - 1 ? " " : ""}
            </Fragment>
          ))}
          {tail.length === 0 && "\u201D"}
        </p>

        <div className="sheet-split">
          <div className="sheet-col">
            <p className="sheet-label">The words responsible</p>
            <p className="policy-implicated">&#8220;{HIGHLIGHT} on lunch&#8221;</p>
            <p className="sheet-note">
              The rule does not say whether the cap applies per person, per receipt or per
              day.
            </p>
          </div>
        </div>
      </article>

      {/* the margin note, in the hand of whoever read it too late */}
      <aside className="scrap" aria-hidden="true">
        <p className="scrap-text">
          What does
          <br />
          &#8220;up to&#8221; mean?
        </p>
      </aside>

      <svg className="collage-arrow" viewBox="0 0 120 90" fill="none" aria-hidden="true">
        <path
          className="arrow-line"
          pathLength="1"
          d="M112 72 C 86 76, 40 62, 20 28"
          stroke="var(--accent)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          className="arrow-head"
          d="M20 28 l 10 9 M20 28 l 1.5 13"
          stroke="var(--accent)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>

      <div className="collage-lower">
      {/* the charge, itemised */}
      <div className="slip-stack">
      <div className="slip slip--behind">
        <p className="slip-head">Lunch cap</p>
        <p className="slip-row">
          <span>per person</span>
          <span className="mono">$10.00</span>
        </p>
      </div>

      <div className="slip slip--front">
        <p className="slip-head">One receipt, three people</p>
        <p className="slip-row">
          <span>lunch</span>
          <span className="mono">$9.00</span>
        </p>
        <p className="slip-row">
          <span>lunch</span>
          <span className="mono">$9.00</span>
        </p>
        <p className="slip-row">
          <span>lunch</span>
          <span className="mono">$9.00</span>
        </p>
        <p className="slip-row slip-row--total">
          <span>total</span>
          <span className="mono">${amount.toFixed(2)}</span>
        </p>
      </div>
      </div>

      {/* the verdict, in front, because it is what you came for */}
      <article className="verdict-card">
        <div className="verdict-top">
          <p className="sheet-label sheet-label--accent">Agent decision</p>
          <p className="breach">
            <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path
                d="M7 1.6 13 12.4H1Z M7 5.9v3 M7 10.3v.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            Breach found
          </p>
        </div>

        <p className="verdict-amount mono">${amount.toFixed(2)}</p>

        <p className="verdict-gloss">
          Three charges of $9.00, each one inside the cap. The agent returned{" "}
          <strong className="verdict-call">{finding.verdict}</strong>.
        </p>

        <div className="verdict-defect">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M4 1.9h6.4L13.9 5.4v10.7H4Z" strokeLinejoin="round" />
            <path d="M10.1 2.1v3.5h3.6" strokeLinejoin="round" />
            <path d="M6.3 9.2h5.3M6.3 12h3.3" strokeLinecap="round" />
          </svg>
          <p>
            The defect: the agent read the limit as <strong>per person</strong>, not per
            receipt. The sentence never said.
          </p>
        </div>

        <blockquote className="verdict-quote">
          <p className="mono">&#8220;{trim(finding.reasoning, 168)}&#8221;</p>
          <footer>the agent, in its own words</footer>
        </blockquote>
      </article>
      </div>
    </div>
  );
}
