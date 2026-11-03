import { Gap } from "./Gap";
import { SectionLabel } from "./SectionLabel";
import type { Result } from "./types";

export function Verdict({ result }: { result: Result }) {
  const s = result.score;

  if (result.inconclusive.inconclusive) {
    return (
      <section className="verdict inconclusive">
        <SectionLabel>inconclusive</SectionLabel>
        <div className="score">
          <Gap label="no score" />
        </div>
        <p className="inconclusive-note">
          {result.inconclusive.why}. A clean result here means these rules were never tested, not
          that they are sound.
        </p>
        <div className="readouts">
          <span>
            <b>cases</b>
            {s.casesRun}
          </span>
          <span>
            <b>commitments found</b>
            {s.intentsTotal}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="verdict">
      <SectionLabel>integrity</SectionLabel>
      <div className="score">{s.integrity}%</div>
      <p className="score-gloss">
        of the commitments put under attack held. {s.intentsBreached} of {s.intentsProbed} were
        breached.
      </p>
      <div className="readouts">
        <span>
          <b>coverage</b>
          {s.coverage}%
        </span>
        <span>
          <b>exposure</b>
          {s.exposure} weighted
        </span>
        <span>
          <b>cases</b>
          {s.casesRun}
        </span>
        <span>
          <b>findings</b>
          {s.findings}
        </span>
      </div>
    </section>
  );
}
