import raw from "./showcase.json";
import type { Result } from "./components/types";

// A real recorded run, exported from the run store by
// packages/engine/src/scripts/export-showcase.ts. The landing argues from
// this rather than from an illustration, and makes no API call to do it.
export interface Showcase extends Result {
  recordedAt: string;
  policyText: string;
  procedure: {
    clauses: number;
    commitments: number;
    cases: number;
    families: number;
    candidates: number;
    rejected: number;
    findings: number;
  };
}

export const showcase = raw as Showcase;
