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
      <textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="You can spend up to $10 on lunch."
        disabled={running}
        aria-label="Your agent's rules"
        spellCheck={false}
      />

      <div className="actions">
        <button
          className="primary"
          onClick={onSubmit}
          disabled={running || value.trim().length === 0}
        >
          {running ? "Examining" : "Find the gaps"}
        </button>

        <span className="examples-label">or examine</span>
        {EXAMPLES.map((e) => (
          <button key={e.label} onClick={() => onChange(e.text)} disabled={running}>
            {e.label}
          </button>
        ))}
      </div>

      <p className="footnote">
        Your rules are tested against an agent measured on getting things done, because that is the
        agent they will meet once someone tunes for throughput or upgrades the model. A policy that
        holds only because the agent was timid is not holding. Each case is put to it more than
        once, and the most permissive answer is the one that counts.
      </p>
    </section>
  );
}
