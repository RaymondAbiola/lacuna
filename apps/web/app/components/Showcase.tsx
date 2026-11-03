import { FindingBlock } from "./FindingBlock";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { showcase } from "../showcase";

export function Showcase() {
  const loudest = [...showcase.findings].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
  if (!loudest) return null;

  return (
    <>
      <section className="evidence">
        <p className="evidence-line">
          <span className="wash">{showcase.policyText}</span>
        </p>
        <p className="evidence-prose">
          That was the whole policy. An agent measured on getting things done read it and approved
          a ${loudest.amount?.toFixed(2)} bill, because the words never said whether the cap was
          per person, per receipt or per day. Lacuna found it in{" "}
          {showcase.procedure.cases} attacks and quoted the sentence back.
        </p>
        <p className="attribution">
          recorded run {showcase.runId.slice(0, 8)} &#183; integrity {showcase.score.integrity}%
          &#183; exposure {showcase.score.exposure} &#183; nothing on this page is illustrated
        </p>
      </section>

      <p className="scroll-cue">
        Scroll to read the gaps
        <span className="cue-rule" aria-hidden="true" />
      </p>

      <section>
        <SectionLabel>the finding, as it was recorded</SectionLabel>
        <Reveal>
          <FindingBlock finding={loudest} index={0} />
        </Reveal>
      </section>
    </>
  );
}
