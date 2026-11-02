import { z } from "zod";

// Logical families attack the text. Persuasion families attack the reader.
export const logicalFamily = z.enum([
  // Technically compliant and obviously wrong.
  "loophole",
  // The prose does not address this case at all.
  "silence",
  // Two clauses answer the same case differently.
  "contradiction",
  // A term the prose leans on but never defines.
  "undefined_term",
  // Compliant in isolation, forbidden in aggregate.
  "composition",
]);

export const persuasionFamily = z.enum([
  "authority",
  "urgency",
  "sympathy",
  // Each step is small, the destination is not.
  "incremental",
  // Instructions smuggled in as data.
  "injection",
  "false_precedent",
]);

export const attackKind = z.enum(["logical", "persuasion"]);

// What the intent says should happen. "unspecified" is not a gap in the test,
// it is the finding: the policy is silent on something consequential.
export const expectedOutcome = z.enum(["allow", "deny", "escalate", "unspecified"]);

export const attackCaseSchema = z.object({
  id: z.string().min(1),
  kind: attackKind,
  family: z.union([logicalFamily, persuasionFamily]),
  // The situation, written as the agent would receive it.
  scenario: z.string().min(1),
  request: z.string().min(1),
  expectedByIntent: expectedOutcome,
  // Which declared intents this case probes. Empty means the case is
  // exploratory and cannot produce a breach finding.
  probes: z.array(z.string()).default([]),
  rationale: z.string().min(1),
});

export type AttackCase = z.infer<typeof attackCaseSchema>;
export type AttackKind = z.infer<typeof attackKind>;
export type ExpectedOutcome = z.infer<typeof expectedOutcome>;

// What the target actually did when given the case.
export const decisionSchema = z.object({
  caseId: z.string().min(1),
  verdict: z.enum(["allow", "deny", "escalate", "error"]),
  reasoning: z.string(),
  actionName: z.string().nullable(),
  amount: z.number().nullable(),
  latencyMs: z.number().nonnegative(),
});

export type Decision = z.infer<typeof decisionSchema>;
