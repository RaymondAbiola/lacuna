import { SectionLabel } from "./SectionLabel";
import { agentRun } from "../agentrun";

/*
 * What the two partners actually do here.
 *
 * Deliberately not a logo strip. Anyone can put a badge on a page; the useful
 * thing to say is which specific feature does which specific job, and what
 * happened when it was measured. Both claims below are checkable against the
 * recorded runs and the source.
 */
export function BuiltOn() {
  const caps = agentRun.policyText;

  return (
    <section className="sec built-on">
      <hr className="rule" />
      <SectionLabel>what this runs on</SectionLabel>

      <div className="built-pair">
        <article>
          <h3 className="built-name">OpenServ SERV</h3>
          <p className="built-role">Does the thinking, in four different jobs.</p>
          <ul className="built-list">
            <li>
              <b>Kronos</b> on the compiler, both attack generators and the judge. It repairs the
              reasoning prompt before inference, which matters most where a sloppy prompt yields a
              plausible but wrong case.
            </li>
            <li>
              <b>Shadow Agent</b> on the judge alone. Deciding whether a finding is real is the one
              step where a second pass earns its cost.
            </li>
            <li>
              <b>The prompt guard</b> on the agent under test. A guard block is recorded as a real
              outcome, not an error: the agent refused to read the input at all.
            </li>
            <li>
              <b>The content filter, opted out of</b> for writing pressure tests. Measured, not
              assumed: on the same prompt the default filter returned 6 cases and opting out
              returned 12. It does not refuse, it quietly thins, and a thinner attack set reads as
              a policy that held.
            </li>
          </ul>
        </article>

        <article>
          <h3 className="built-name">Kite Passport</h3>
          <p className="built-role">Is what the agent actually spends under.</p>
          <ul className="built-list">
            <li>
              The reference agent holds a real spending session, approved with a passkey, and
              publishes what Kite will enforce whatever its instructions say.
            </li>
            <li>
              Lacuna records those caps and sorts every finding by whether anything outside the
              wording would have stopped it.
            </li>
            <li>
              A per-payment cap is never treated as containing a splitting attack. Four payments
              of $4 defeat a $5 limit without once exceeding it, so only a session total can hold
              those.
            </li>
          </ul>
          <p className="built-punch">
            The cap holds. That is the point. A $24.99 reimbursement and a $22.80 lunch both moved
            without troubling a $50 ceiling, because the gap was never in the number.
          </p>
        </article>
      </div>

      <p className="attribution">
        audited agent: <span className="mono">{caps}</span>
      </p>
    </section>
  );
}
