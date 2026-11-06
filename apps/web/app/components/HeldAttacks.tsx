import { SectionLabel } from "./SectionLabel";

export function HeldAttacks({ held }: { held: { id: string; family: string; why: string }[] }) {
  if (held.length === 0) return null;

  return (
    <section>
      <hr className="rule" />
      <SectionLabel as="h2">attacks that did not become findings &#183; {held.length}</SectionLabel>
      <p className="quiet">
        Listed so you can see what was tried and not only what stuck. An audit that shows you only
        its hits is not an audit.
      </p>
      <ul className="held">
        {held.map((h) => (
          <li key={h.id}>
            <span className="cid">{h.id}</span>
            {h.family.replace(/_/g, " ")}: {h.why}
          </li>
        ))}
      </ul>
    </section>
  );
}
