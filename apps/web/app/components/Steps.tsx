import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { showcase } from "../showcase";

// The verbs are borrowed from textual scholarship rather than invented,
// because the thing being examined is a text with a hole in it. Every value
// shown is counted from the recorded run, not written by hand.
export function Steps() {
  const p = showcase.procedure;

  const steps: { verb: string; gloss: string; value: string; note: string }[] = [
    {
      verb: "Transcribe",
      gloss: "The policy, split into clauses.",
      value: `${p.clauses} clause`,
      note: "Split deterministically in code, never by a model, so a clause keeps the same identity between runs and a finding can be compared across them.",
    },
    {
      verb: "Collate",
      gloss: "What the wording commits you to.",
      value: `${p.commitments} commitment`,
      note: "Read out of your sentence and shown back to you before anything is attacked. Each one is marked according to whether you stated it or Lacuna inferred it, because inferring the standard and then marking against it would be marking its own homework.",
    },
    {
      verb: "Probe",
      gloss: "Cases where the letter and the commitment come apart.",
      value: `${p.cases} attacks, ${p.families} families`,
      note: "Loopholes, silences, contradictions, undefined terms and compositions. Concrete by construction: named amounts, named times, named parties. A case that says the amount is ambiguous is not a case.",
    },
    {
      verb: "Try",
      gloss: "Put to an agent that wants to say yes.",
      value: "2 samples per case",
      note: "Agents are not deterministic. The same case flips between allow and deny, so each one is tried more than once and the most permissive answer counts. An attack that succeeds one time in three is still a vulnerability.",
    },
    {
      verb: "Adjudicate",
      gloss: "Confirmed or rejected, with the words quoted.",
      value: `${p.candidates} candidates, ${p.rejected} rejected, ${p.findings} findings`,
      note: "A judge that cannot clear a policy is not a judge. Quotes are checked against your text before publication, so a quotation you cannot find in your own policy is never shown.",
    },
  ];

  return (
    <section>
      <hr className="rule" />
      <SectionLabel>how Lacuna reads one sentence, in five steps</SectionLabel>

      <ol className="steps">
        {steps.map((s, i) => (
          <Reveal key={s.verb}>
            <li style={{ animationDelay: `${i * 60}ms` }}>
              <p className="step-verb">
                <span className="step-n">{String(i + 1).padStart(2, "0")}</span>
                {s.verb}
              </p>
              <p className="step-gloss">{s.gloss}</p>
              <p className="step-value">{s.value}</p>
              <p className="step-note">{s.note}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
