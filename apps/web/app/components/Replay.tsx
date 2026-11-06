import { SectionLabel } from "./SectionLabel";
import type { ReplayDelta } from "./types";

/*
 * Re-runs the attacks this run used, rather than writing new ones.
 *
 * Two things come out of the same button. Press it without touching the rule
 * and you learn whether the result was stable, because the attacks are fixed
 * and only the agent's answers can move. Edit the rule first and you learn
 * whether your fix worked, which fresh attacks can never tell you: a patch
 * measured against different questions is a different experiment.
 *
 * The comparison is by case, not by commitment. Editing a policy recompiles
 * it and the compiler reassigns commitment ids, so matching on those would
 * quietly compare two different promises.
 */
export function Replay({
  delta,
  replayedFrom,
  running,
  onReplay,
  compact = false,
}: {
  delta: ReplayDelta | null;
  replayedFrom: string | null;
  running: boolean;
  onReplay: () => void;
  // A second, bare control for the foot of a long report, so somebody who
  // read to the bottom does not have to scroll back up to act on it.
  compact?: boolean;
}) {
  const button = (
    <button type="button" className="primary replay-go" onClick={onReplay} disabled={running}>
      {running ? "running" : "re-run these same attacks"}
    </button>
  );

  if (compact) {
    return (
      <section className="replay replay--compact">
        <hr className="rule" />
        {button}
        <p className="quiet replay-aside">
          Edit the rule above first to test a fix against these same attacks.
        </p>
      </section>
    );
  }

  return (
    <section className="replay">
      <hr className="rule" />
      <SectionLabel as="h2">put the same attacks again</SectionLabel>

      <div className="actions replay-lead">{button}</div>

      {delta && replayedFrom ? (
        <>
          <p className="quiet">
            Against the identical attacks from run {replayedFrom.slice(0, 8)}.
          </p>
          <div className="readouts">
            <span>
              <b>fixed</b>
              {delta.fixed.length}
            </span>
            <span>
              <b>still failing</b>
              {delta.persisted.length}
            </span>
            <span>
              <b>newly broken</b>
              {delta.regressed.length}
            </span>
            <span>
              <b>exposure</b>
              {delta.exposure > 0 ? `+${delta.exposure}` : delta.exposure}
            </span>
          </div>

          {delta.regressed.length > 0 ? (
            <p className="replay-warn">
              {delta.regressed.join(", ")} now fails and did not before. A patch that closes one
              hole and opens another shows as no change at all if you only count findings.
            </p>
          ) : null}

          {delta.fixed.length > 0 && delta.regressed.length === 0 ? (
            <p className="replay-good">
              {delta.fixed.join(", ")} no longer fails, and nothing new broke.
            </p>
          ) : null}
        </>
      ) : (
        <p className="quiet">
          Edit the rule above and press this to put the same attacks to the new wording. That is
          the only way to tell whether a fix worked: run it again normally and you get different
          attacks, so you would be comparing two different experiments. Press it without changing
          anything to see whether the result holds up at all.
        </p>
      )}

    </section>
  );
}
