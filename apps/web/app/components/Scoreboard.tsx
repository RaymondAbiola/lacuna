"use client";

import { useState } from "react";
import { SectionLabel } from "./SectionLabel";
import { agentRun } from "../agentrun";
import { contrast } from "../contrast";
import type { Showcase } from "../showcase";

/*
 * Two recorded runs, and a question before each one.
 *
 * The argument above this section is that nobody can read a policy and tell
 * whether it holds. This is where that stops being a claim. A reader calls
 * each one, and then sees what actually happened when it was attacked.
 *
 * It makes no API call. Every number comes from a fixture committed to the
 * repository, so a judge can play it as often as they like and it costs
 * nothing, and the run id beside each answer is checkable.
 *
 * The first round is the one that matters: a policy that held. Without it
 * the game is won by always answering "it leaks", which would teach exactly
 * the wrong thing about a tool whose credibility rests on being able to clear
 * a policy.
 */

interface Round {
  run: Showcase;
  // What the reader is told before calling it. Never a hint at the answer.
  context: string;
}

/*
 * The lunch run is deliberately not here. Its answer is printed in the hero,
 * so asking about it would be asking a reader to recall rather than judge.
 * These two appear nowhere else on the page in full.
 */
const ROUNDS: Round[] = [
  { run: contrast, context: "Six rules, written by someone who had thought about this." },
  {
    run: agentRun,
    context: "Three rules, and this time a deployed agent was holding them, audited over HTTP.",
  },
];

type Call = "holds" | "leaks";

const truth = (run: Showcase): Call => (run.findings.length > 0 ? "leaks" : "holds");

export function Scoreboard() {
  const [calls, setCalls] = useState<(Call | null)[]>(ROUNDS.map(() => null));

  const answer = (index: number, call: Call) => {
    setCalls((prev) => prev.map((c, i) => (i === index ? call : c)));
  };

  const made = calls.filter((c) => c !== null).length;
  const right = calls.filter((c, i) => c !== null && c === truth(ROUNDS[i]!.run)).length;

  return (
    <section className="sec challenge" id="challenge" aria-labelledby="challenge-title">
      <SectionLabel>01 / Call it yourself</SectionLabel>
      <div className="section-intro">
        <h2 className="section-title" id="challenge-title">Looks safe.<br /><em>Would you bet on it?</em></h2>
        <p>Read the rules. Make your call. Then reveal what the recorded audit found.</p>
        <span className="section-note">Two recorded policies. No live audit required.</span>
      </div>

      <ol className="rounds">
        {ROUNDS.map((round, i) => {
          const call = calls[i] ?? null;
          const actual = truth(round.run);
          const correct = call === actual;
          const finding = round.run.findings[0];
          const moved = finding?.amount ?? null;

          return (
            <li className="round" key={round.run.runId}>
              <div className="round-heading"><span>Policy {String(i + 1).padStart(2, "0")}</span><span className="round-heading-status">{call === null ? "Awaiting your call" : "Evidence revealed"}</span></div>
              <p className="round-context">{round.context}</p>
              <p className="round-policy">{round.run.policyText}</p>

              <div className="round-ask">
                  <span className="round-q">{call === null ? "Your verdict?" : "Your prediction"}</span>
                  <button type="button" className="call" aria-pressed={call === "holds"} aria-disabled={call !== null} onClick={() => { if (call === null) answer(i, "holds"); }}>
                    <span aria-hidden="true">✓</span> It holds
                  </button>
                  <button type="button" className="call" aria-pressed={call === "leaks"} aria-disabled={call !== null} onClick={() => { if (call === null) answer(i, "leaks"); }}>
                    <span aria-hidden="true">↗</span> It leaks
                  </button>
                </div>
              {call !== null ? (
                <div className="round-result" aria-live="polite">
                  <p className={correct ? "round-mark right" : "round-mark wrong"}>
                    {correct ? "You called it." : `You said it ${call}.`}{" "}
                    <strong>
                      It {actual === "leaks" ? "leaked" : "held"}
                      {actual === "leaks" && moved !== null ? `, and $${moved.toFixed(2)} moved` : ""}
                      .
                    </strong>
                  </p>

                  <div className="readouts">
                    <span>
                      <b>integrity</b>
                      {round.run.score.integrity}%
                    </span>
                    <span>
                      <b>attacks</b>
                      {round.run.score.casesRun}
                    </span>
                    <span>
                      <b>families</b>
                      {round.run.procedure.families}
                    </span>
                    <span>
                      <b>findings</b>
                      {round.run.score.findings}
                    </span>
                  </div>

                  <p className="round-why">
                    {finding
                      ? finding.summary
                      : `Every attack that reached a commitment was refused or escalated. ${round.run.procedure.candidates} reached the judge and ${round.run.procedure.rejected} were thrown out.`}
                  </p>

                  <p className="attribution">recorded run {round.run.runId.slice(0, 8)}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {made > 0 && (
        <p className="tally" aria-live="polite">
          {right} of {made} called{made === ROUNDS.length ? "." : " so far."}
          {made === ROUNDS.length && right < ROUNDS.length
            ? " Which is the point: these were read by someone who wrote them, and they still went out like that."
            : ""}
        </p>
      )}
      <p className="challenge-footnote">Your intuition has limits. Your agent&apos;s permissions should have them too. <a href="/arena">Examine your own rules <span aria-hidden="true">↗</span></a></p>
    </section>
  );
}
