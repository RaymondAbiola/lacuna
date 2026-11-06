import { Gap } from "./Gap";
import { SectionLabel } from "./SectionLabel";

interface Props {
  terms: { term: string; why: string }[];
  questions: string[];
}

export function Lacunae({ terms, questions }: Props) {
  if (terms.length === 0 && questions.length === 0) return null;

  return (
    <>
      {terms.length > 0 ? (
        <section>
          <hr className="rule" />
          <SectionLabel as="h2">terms your rules never define</SectionLabel>
          <p className="quiet">Each of these decides an outcome and is left to the reader.</p>
          <ul className="terms">
            {terms.map((t) => (
              <li key={t.term}>
                <span className="term">{t.term}</span>
                <Gap label="undefined" /> {t.why}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {questions.length > 0 ? (
        <section>
          <hr className="rule" />
          <SectionLabel as="h2">questions your rules leave open</SectionLabel>
          <ul className="questions">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
