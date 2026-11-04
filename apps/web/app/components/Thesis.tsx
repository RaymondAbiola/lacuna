import { HeroScene } from "./HeroScene";
import { showcase } from "../showcase";

export function Thesis() {
  const loudest = [...showcase.findings].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
  const spent = loudest?.amount ?? 0;

  return (
    <section className="thesis">
      <h2 className="thesis-lines">
        <span>you never tested</span>
        <span>the sentence</span>
        <span>that spends</span>
        <span>your money &#8212;</span>
      </h2>

      {/* Arrives after the sentence has been read, not with it. */}
      <p className="thesis-number">
        <span className="colon">:</span> $10 on lunch bought ${spent.toFixed(2)}
      </p>

      <figure className="scene-figure">
        <HeroScene />
      </figure>
    </section>
  );
}
