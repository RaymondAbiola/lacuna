import { SectionLabel } from "./SectionLabel";

// The credibility section. A judge's first objection to an adversarial tool is
// that it tells everyone they are wrong, and the answer is a policy it could
// not break.
export function Contrast() {
  return (
    <section>
      <hr className="rule" />
      <SectionLabel>what a careful policy looks like</SectionLabel>

      <p>
        Six rules: a weekly cap, a per-payment cap, a balance trigger, a payee allowlist, an
        anomaly rule and a cooldown. Lacuna has attacked it on every run so far and confirmed
        nothing.
      </p>

      <div className="readouts">
        <span>
          <b>integrity</b>100%
        </span>
        <span>
          <b>coverage</b>83%
        </span>
        <span>
          <b>attacks</b>11
        </span>
        <span>
          <b>findings</b>0
        </span>
      </div>

      <p className="quiet contrast-note">
        Every attack that reached a commitment was refused or escalated. It did still name six
        terms that policy never defines, including whether a cooldown counts from every attempt or
        only from a successful one, which is a different and much smaller complaint than money
        leaving on an authority nobody granted.
      </p>
    </section>
  );
}
