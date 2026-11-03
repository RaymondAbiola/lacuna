import { z } from "zod";
import { clauseSchema } from "./clause.js";

// What the agent is physically able to do. A loophole in the prose only
// matters if some action can walk through it, so the surface is part of the
// subject under test rather than context.
export const actionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  movesMoney: z.boolean().default(false),
  irreversible: z.boolean().default(false),
});

export type Action = z.infer<typeof actionSchema>;

// The oracle. Everything this tool reports is a disagreement between what the
// author says they meant and what the prose actually permits, so without
// declared intent there is nothing to find and no way to be wrong.
export const intentSchema = z.object({
  id: z.string().min(1),
  // Written as an absolute: "never pays the same invoice twice".
  statement: z.string().min(1),
  disposition: z.enum(["forbid", "require", "escalate"]),
});

export type Intent = z.infer<typeof intentSchema>;

export const policySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  // The artifact under test, exactly as it was given to the agent.
  text: z.string().min(1),
  intents: z.array(intentSchema).min(1),
  actions: z.array(actionSchema).min(1),
  // Numeric caps the host enforces outside the prose, such as a Kite spending
  // session. Recorded because a prose loophole that a hard cap already blocks
  // is a weaker finding than one nothing blocks.
  hardLimits: z.record(z.string(), z.number()).default({}),
});

export type Policy = z.infer<typeof policySchema>;

// An intent LACUNA read out of the prose rather than one the author wrote.
// Carries its provenance so the author can judge whether the reading is fair,
// and is shown for confirmation before any attack runs. Without that step the
// tool would be inventing the oracle and marking its own homework.
export const inferredIntentSchema = intentSchema.extend({
  sourceClauses: z.array(z.number().int().nonnegative()).default([]),
  confidence: z.number().min(0).max(1),
  // Set once a human has seen it. Only confirmed intents produce findings the
  // report presents as breaches rather than as suggestions.
  confirmed: z.boolean().default(false),
});

export type InferredIntent = z.infer<typeof inferredIntentSchema>;

// A term the prose leans on but never defines. Not a finding by itself, but
// the raw material for the strongest loophole cases.
export const undefinedTermSchema = z.object({
  term: z.string().min(1),
  why: z.string().min(1),
  sourceClauses: z.array(z.number().int().nonnegative()).default([]),
});

export type UndefinedTerm = z.infer<typeof undefinedTermSchema>;

export const compiledPolicySchema = z.object({
  text: z.string().min(1),
  clauses: z.array(clauseSchema),
  intents: z.array(inferredIntentSchema),
  actions: z.array(actionSchema),
  undefinedTerms: z.array(undefinedTermSchema).default([]),
  // What the model could not resolve about the policy's own scope. Surfaced
  // rather than guessed at.
  openQuestions: z.array(z.string()).default([]),
});

export type CompiledPolicy = z.infer<typeof compiledPolicySchema>;
