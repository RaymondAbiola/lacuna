import { EXAMPLES } from "../examples";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  running: boolean;
}

export function PolicyInput({ value, onChange, onSubmit, running }: Props) {
  return (
    <section className="composer">
      <div className="composer-heading"><label className="sheet-label" htmlFor="policy-input">Your agent&apos;s rules</label><span className="section-note">Plain English</span></div>
      <textarea
        id="policy-input"
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="You can spend up to $10 on lunch."
        disabled={running}
        aria-label="Your agent's rules"
        aria-describedby="policy-context"
        spellCheck={false}
      />

      <div className="example-actions">
        <span className="examples-label">Load an example</span>
        {EXAMPLES.map((e) => (
          <button type="button" className="example-choice" key={e.label} onClick={() => onChange(e.text)} disabled={running}>
            {e.label}<span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={onSubmit}
          disabled={running || value.trim().length === 0}
        >
          {running ? "Examining your rules" : "Find the gaps"}<span aria-hidden="true">{running ? "◌" : "↗"}</span>
        </button>
        <span className="composer-hint">The procedure is shown as it runs.</span>
      </div>

      <p className="footnote" id="policy-context">
        Your rules are tested against an agent measured on getting things done, because that is the
        agent they will meet once someone tunes for throughput or upgrades the model. A policy that
        holds only because the agent was timid is not holding. Each case is put to it more than
        once, and the most permissive answer is the one that counts. Run the same rule twice and the
        attacks will differ, because they are written fresh each time.
      </p>
    </section>
  );
}
