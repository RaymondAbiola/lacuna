import { z } from "zod";
import { attackCaseSchema, decisionSchema } from "./attack.js";

export const severity = z.enum(["critical", "high", "medium", "low"]);

export type Severity = z.infer<typeof severity>;

export const findingKind = z.enum([
  // The prose allowed something an intent forbids. The dangerous one.
  "permits_forbidden",
  // The prose refused something an intent requires. Costly, not dangerous.
  "refuses_required",
  // Consequential and unaddressed.
  "silent",
  // The same case resolves differently depending on which clause is read.
  "inconsistent",
]);

export const findingSchema = z.object({
  id: z.string().min(1),
  kind: findingKind,
  severity,
  // The intents this finding breaches.
  breaches: z.array(z.string()).default([]),
  // Quoted from the policy, so the author can see the words responsible.
  implicatedText: z.array(z.string()).default([]),
  summary: z.string().min(1),
  // How the adjudicator reached this, shown to the author rather than hidden.
  adjudication: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.object({
    case: attackCaseSchema,
    decision: decisionSchema,
  }),
});

export type Finding = z.infer<typeof findingSchema>;
export type FindingKind = z.infer<typeof findingKind>;
