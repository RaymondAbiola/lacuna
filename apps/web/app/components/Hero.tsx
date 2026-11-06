import Link from "next/link";
import { FeatureStrip } from "./FeatureStrip";
import { HeroCollage } from "./HeroCollage";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="shell hero-grid">
        {/* One column, top to bottom: the claim, the invitation, and the
            capabilities pinned to its foot so the column has no dead air. */}
        <div className="hero-copy">
          <p className="eyebrow">
            Test before execution
            <span className="eyebrow-rule" aria-hidden="true" />
          </p>

          <h1 className="hero-title" id="hero-title">
            <span>You never tested</span>
            <span>the sentence that</span>
            <span>spends your money.</span>
          </h1>

          <p className="hero-sub">
            Lacuna finds what your rules actually permit, before your AI agent moves a
            cent.
          </p>

          <div className="hero-actions">
            <Link className="btn-primary" href="/arena">
              <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                <path d="M3.5 2.2 11.6 7 3.5 11.8Z" fill="currentColor" />
              </svg>
              Try It Now
            </Link>
            <a className="btn-quiet" href="#method">
              See How It Works
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path
                  d="M2 8h11M9 4l4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

          <FeatureStrip />
        </div>

        <div className="hero-evidence">
          <HeroCollage />
        </div>
      </div>

      <div className="shell hero-rule">
        <p className="hero-tagline">A forensic lens on your words.</p>
      </div>
    </section>
  );
}
