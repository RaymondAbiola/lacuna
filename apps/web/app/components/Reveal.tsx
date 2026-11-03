"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Adds a class once the child scrolls into view, so arrivals and the
 * highlighter are seen rather than missed above the fold.
 *
 * It fails visible. If there is no IntersectionObserver, or the reader has
 * asked for reduced motion, the content is shown at once. Nobody is ever left
 * looking at a blank page because an animation did not fire.
 */
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const node = ref.current;
    if (!node) {
      setShown(true);
      return;
    }

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

  return (
    <div ref={ref} className={`reveal ${shown ? "shown" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
