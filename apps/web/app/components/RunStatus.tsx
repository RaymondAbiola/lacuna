"use client";

import { useEffect, useState } from "react";

export function RunStatus({ stage, detail }: { stage?: string; detail?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="run-status">
      <div className="run-status-top">
        <span><span className="status-dot" aria-hidden="true" />Audit in progress</span>
        <span className="run-clock" role="timer" aria-live="off">
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </span>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="run-stage">{stage ? stage.replace(/_/g, " ") : "Preparing the examination"}</p>
        <p className="run-detail">
          {detail ?? "Connecting to the audit. The log will show each stage as it arrives."}
        </p>
      </div>
      <div className="run-indicator" aria-hidden="true"><span /></div>
      <p className="run-note">The log updates as each stage completes. Keep this page open.</p>
    </div>
  );
}
