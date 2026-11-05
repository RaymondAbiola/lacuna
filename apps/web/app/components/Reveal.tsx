"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Adds a class once the child scrolls into view, so arrivals and the
 * highlighter are seen rather than missed above the fold.
 *
 * It fails visible, and it means it. The hidden state is opt-in: nothing is
 * hidden until this component has mounted and decided it will animate, so the
 * server-rendered markup shows the finding and the five steps whether or not
 * the JavaScript ever arrives. The earlier version hid them in CSS and
 * revealed them from an effect, which meant a slow or failed hydration left a
 * judge looking at empty space where the evidence should be.
 *
 * Content already on screen at mount is shown straight away rather than armed,
 * because hiding something the reader can see in order to animate it back is
 * a flicker, not an arrival.
 */
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const node = ref.current;
    if (reduced || typeof IntersectionObserver === "undefined" || !node) return;

    if (node.getBoundingClientRect().top < window.innerHeight) return;

    setArmed(true);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const classes = ["reveal", armed ? "armed" : "", shown ? "shown" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={classes}>
      {children}
    </div>
  );
}
