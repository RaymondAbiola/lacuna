import { z } from "zod";
import { attackCaseSchema, decisionSchema } from "./attack.js";
import { findingSchema } from "./finding.js";
import { policySchema } from "./policy.js";

export const targetSchema = z.object({
  kind: z.enum(["local", "http"]),
  // Present for http targets, so a report says what was actually audited.
  url: z.string().nullable(),
  model: z.string().nullable(),
});

export const runSchema = z.object({
  id: z.string().min(1),
  startedAt: z.string().min(1),
  finishedAt: z.string().nullable(),
  policy: policySchema,
  target: targetSchema,
  cases: z.array(attackCaseSchema),
  decisions: z.array(decisionSchema),
  findings: z.array(findingSchema),
});

export type Run = z.infer<typeof runSchema>;
export type Target = z.infer<typeof targetSchema>;
