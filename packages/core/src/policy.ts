import { z } from "zod";

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
