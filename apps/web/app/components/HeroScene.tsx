import { showcase } from "../showcase";

/*
 * The whole product, without words: a sentence is probed word by word, the
 * probe reaches the one word nothing defines, drops through, and money stacks
 * past the ceiling the author set.
 *
 * Pure SVG and CSS on one 9s timeline, so every element stays locked together
 * and nothing waits on JavaScript. Under prefers-reduced-motion the scene
 * renders in its final state, which still tells the story.
 */

// x ranges for each word of "You can spend up to $10 on lunch", in viewBox
// units. The last is the undefined one: present in the text, backed by
// nothing.
const WORDS: { x: number; w: number; hollow?: boolean }[] = [
  { x: 60, w: 42 },
  { x: 112, w: 40 },
  { x: 162, w: 66 },
  { x: 238, w: 56 },
  { x: 304, w: 44 },
  { x: 358, w: 28 },
  { x: 396, w: 74, hollow: true },
];

const BARS = [
  { y: 316, h: 30, label: "$9.50" },
  { y: 286, h: 30, label: "$7.00" },
  { y: 220, h: 66, label: "$10.50" },
];

export function HeroScene() {
  const total = [...showcase.findings].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0]?.amount;

  return (
    <svg
      className="scene"
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`A sentence reading "${showcase.policyText}" is tested word by word. The word lunch is undefined, and spending passes the ten dollar ceiling.`}
    >
      {/* the plate: real parchment, photographed, with the gap torn where the
          undefined word sits. Inside the viewBox so it scales with the vectors.
          Masked at the edges so it settles into the page instead of sitting on
          it as a rectangle. The mask covers the image only, so nothing drawn
          over it loses its edge. */}
      <defs>
        <filter id="plate-edge">
          <feGaussianBlur stdDeviation="11" />
        </filter>
        <mask id="plate-mask">
          <rect x="16" y="12" width="768" height="376" rx="8" fill="#fff" filter="url(#plate-edge)" />
        </mask>
      </defs>
      <image
        href="/hero-plate.webp"
        x="0"
        y="0"
        width="800"
        height="400"
        preserveAspectRatio="xMidYMid slice"
        mask="url(#plate-mask)"
      />

      {/* the sentence, as written */}
      <text className="scene-caption" x="60" y="64">
        {showcase.policyText}
      </text>

      {/* each word as a rule. the last is hollow: written, undefined */}
      {WORDS.map((word, i) => (
        <rect
          key={word.x}
          className={word.hollow ? "scene-word scene-word--hollow" : "scene-word"}
          x={word.x}
          y="104"
          width={word.w}
          height="9"
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}

      {/* the gap: appears once the probe has drained the hollow word */}
      <text className="scene-gap" x="408" y="113">
        [ &#x22ef; ]
      </text>

      {/* the probe, sweeping and then dropping through */}
      <line className="scene-probe" x1="50" y1="84" x2="50" y2="133" />
      <line className="scene-fall" x1="433" y1="118" x2="433" y2="118" />

      {/* the consequence */}
      <text className="scene-label" textAnchor="end" x="548" y="246">
        YOUR $10 CEILING
      </text>
      <line className="scene-ceiling" x1="556" y1="250" x2="770" y2="250" />

      {/* The reveal window lives in the scene-stack keyframes (58% of the 9s
          loop, right after the probe drops through). A delay on top of that
          would shift the whole cycle and drift the charges out of step with
          the fall, so this stagger stays small. */}
      {BARS.map((bar, i) => (
        <g key={bar.label} style={{ animationDelay: `${i * 140}ms` }} className="scene-stack">
          <rect className="scene-bar" x="560" y={bar.y} width="46" height={bar.h} />
          <text className="scene-amount" x="618" y={bar.y + bar.h - 9}>
            {bar.label}
          </text>
        </g>
      ))}

      <text className="scene-total" x="560" y="204">
        {total ? `$${total.toFixed(2)} spent` : "over"}
      </text>

      {/* the bench */}
      <line className="scene-bench" x1="40" y1="346" x2="770" y2="346" />
    </svg>
  );
}
