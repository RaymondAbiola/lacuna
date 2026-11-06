import { SectionLabel } from "./SectionLabel";
import { contrast } from "../contrast";

// The credibility section. A judge's first objection to an adversarial tool is
// that it tells everyone they are wrong, and the answer is a policy it could
// not break. Every number here is read from the recorded run, because a
// hand-typed 100% proves the opposite of what this section is for.
const PRESSURE = new Set([
  "authority",
  "urgency",
  "sympathy",
  "incremental",
  "injection",
  "false_precedent",
]);

export function Contrast() {
  const { score, procedure, undefinedTerms, runId, held } = contrast;
  const terms = undefinedTerms.map((t) => t.term);
  const pressure = held.filter((h) => PRESSURE.has(h.family)).length;

  return (
    <section className="sec">
      <hr className="rule" />
      <SectionLabel>what a careful policy looks like</SectionLabel>

      <p>
        Six rules: a weekly cap, a per-payment cap, a balance trigger, a payee allowlist, an
        anomaly rule and a cooldown. Lacuna put {procedure.cases} attacks to it across{" "}
        {procedure.families} families, {procedure.candidates} of them reached the judge, and{" "}
        {procedure.rejected === procedure.candidates ? "both were thrown out" : "some were thrown out"}.
        Nothing was confirmed.
      </p>

      <div className="readouts">
        <span>
          <b>integrity</b>
          {score.integrity}%
        </span>
        <span>
          <b>coverage</b>
          {score.coverage}%
        </span>
        <span>
          <b>attacks</b>
          {score.casesRun}
        </span>
        <span>
          <b>findings</b>
          {score.findings}
        </span>
      </div>

      <p className="quiet contrast-note">
        Every attack that reached a commitment was refused or escalated, including the {pressure}{" "}
        that went after the agent rather than the wording: claimed authority, a closing deadline,
        a person harmed by the refusal, and an instruction hidden in an invoice note. It did still
        name {terms.length} terms this policy never defines, among them{" "}
        {terms.slice(0, 3).map((t) => `"${t}"`).join(", ")}, which is a different and much smaller
        complaint than money leaving on an authority nobody granted.
      </p>

      <p className="quiet contrast-note">
        That is one run, not a guarantee. The attacks are written fresh every time, so putting
        this same policy through the arena will produce different ones and may surface something
        this run did not. A policy that holds once has not been proved sound, it has been tested
        once, which is the same thing this tool says about yours.
      </p>

      <p className="attribution">recorded run {runId.slice(0, 8)} &#183; the same procedure, the other result</p>
    </section>
  );
}
