"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function CollageMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const collage = element;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // On smaller screens the evidence starts below the headline. Save its
    // single entrance for when it is actually in view.
    const intro = collage.getAnimations({ subtree: true });
    let observer: IntersectionObserver | undefined;
    if (
      !reducedMotion.matches &&
      collage.getBoundingClientRect().top >= window.innerHeight
    ) {
      intro.forEach((animation) => {
        animation.pause();
        animation.currentTime = 0;
      });
      observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return;
        observer?.disconnect();
        if (!reducedMotion.matches) intro.forEach((animation) => animation.play());
      }, { threshold: 0.12 });
      observer.observe(collage);
    }
    const stopWaiting = () => {
      if (reducedMotion.matches) observer?.disconnect();
    };
    reducedMotion.addEventListener("change", stopWaiting);

    const media = window.matchMedia(
      "(min-width: 1100px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let removePointerMotion: (() => void) | undefined;

    function syncPointerMotion() {
      removePointerMotion?.();
      removePointerMotion = undefined;
      if (!media.matches) return;

      const events = new AbortController();
      const { signal } = events;
      let active = true;
      let ready = false;
      let frame = 0;
      let x = 0;
      let y = 0;

      // Pointer depth begins after the last ink mark has settled.
      void Promise.all(
        collage.getAnimations({ subtree: true }).map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      ).then(() => {
        if (!active) return;
        ready = true;
        collage.dataset.motionReady = "true";
      });

      function reset() {
        cancelAnimationFrame(frame);
        frame = 0;
        collage.style.removeProperty("--pointer-x");
        collage.style.removeProperty("--pointer-y");
      }

      function move(event: PointerEvent) {
        if (!ready || event.pointerType !== "mouse" || event.buttons) return;
        const bounds = collage.getBoundingClientRect();
        x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
        y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
        if (frame) return;
        // No idle animation loop and no React renders on pointer movement.
        frame = requestAnimationFrame(() => {
          collage.style.setProperty("--pointer-x", x.toFixed(3));
          collage.style.setProperty("--pointer-y", y.toFixed(3));
          frame = 0;
        });
      }

      collage.addEventListener("pointermove", move, { passive: true, signal });
      collage.addEventListener("pointerleave", reset, { signal });
      collage.addEventListener("pointercancel", reset, { signal });
      collage.addEventListener("pointerdown", reset, { signal });
      window.addEventListener("blur", reset, { signal });
      window.addEventListener("scroll", reset, { passive: true, signal });
      document.addEventListener("visibilitychange", reset, { signal });

      removePointerMotion = () => {
        active = false;
        reset();
        delete collage.dataset.motionReady;
        events.abort();
      };
    }

    syncPointerMotion();
    media.addEventListener("change", syncPointerMotion);
    return () => {
      observer?.disconnect();
      intro.filter((animation) => animation.playState === "paused").forEach((animation) => animation.play());
      reducedMotion.removeEventListener("change", stopWaiting);
      removePointerMotion?.();
      media.removeEventListener("change", syncPointerMotion);
    };
  }, []);

  return (
    <div ref={ref} className="collage" aria-label="The recorded finding, as evidence">
      {children}
    </div>
  );
}
