import { SectionLabel } from "./SectionLabel";
import type { Commitment } from "./types";

export function Commitments({ intents }: { intents: Commitment[] }) {
  if (intents.length === 0) return null;

  return (
    <section>
      <hr className="rule" />
      <SectionLabel>what you appear to have promised</SectionLabel>
      <p className="quiet">
        Read out of your wording, not supplied by you. Every finding below is a disagreement
        between one of these and what the text actually permits, so correct anything you disagree
        with.
      </p>
      <ul className="commitments">
        {intents.map((i) => (
          <li key={i.id} data-breached={i.breached}>
            <span className="state">{i.breached ? "breached" : "held"}</span>
            {i.statement}{" "}
            <span className="provenance">
              {i.disposition}
              {i.stated ? "" : ", inferred rather than stated"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
