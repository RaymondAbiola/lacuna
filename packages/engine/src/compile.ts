import { z } from "zod";
import {
  type CompiledPolicy,
  splitClauses,
  type Clause,
} from "@lacuna/core";
import { servJson, type ServResult } from "./serv.js";

// The wire shape the model answers in. Deliberately free of defaults and
// ranges, because strict structured output strips those and a silently
// missing field would become a silently empty intent list.
const inferenceSchema = z.object({
  intents: z.array(
    z.object({
      id: z.string(),
      statement: z.string(),
      disposition: z.enum(["forbid", "require", "escalate"]),
      sourceClauses: z.array(z.number().int()),
      confidence: z.number(),
    }),
  ),
  actions: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      movesMoney: z.boolean(),
      irreversible: z.boolean(),
    }),
  ),
  undefinedTerms: z.array(
    z.object({
      term: z.string(),
      why: z.string(),
      sourceClauses: z.array(z.number().int()),
    }),
  ),
  openQuestions: z.array(z.string()),
});

const SYSTEM = `You read a policy written in plain English that governs an autonomous agent, and you report what the policy appears to promise. You are not deciding anything and you are not improving the policy.

Return four things.

intents: the absolute commitments a reader would take this policy to make. Write each as a flat statement of what must never, must always, or must be escalated, in the author's own terms. Use disposition "forbid" for a prohibition, "require" for an obligation, "escalate" for anything needing a human. Cite the clause indices the intent rests on. Set confidence low when the clause only implies the commitment rather than stating it.

actions: what this policy implies the agent is able to do. Mark movesMoney true when performing it transfers value. Mark irreversible true when it cannot be undone without someone else's cooperation.

undefinedTerms: words the policy leans on to decide something but never defines. A term qualifies when two reasonable readers could apply it differently and the difference changes an outcome. Quantities with no unit, categories with no membership test, and thresholds with no reference point all qualify.

openQuestions: what you could not determine about the policy's own scope. Say it plainly rather than guessing.

Report what the words permit, not what you assume the author wanted. If the policy is silent on something central, that silence belongs in openQuestions, not in an invented intent.`;

function numbered(clauses: Clause[]): string {
  return clauses.map((c) => `[${c.index}] (${c.form}) ${c.text}`).join("\n");
}

export interface CompileOptions {
  model?: string;
  // Kronos audits and repairs the generated reasoning prompt before inference.
  // On by default: SERV's own guidance is to use it for prompts with
  // procedural rules and multiple conditions, which is every policy here.
  kronos?: boolean;
}

export async function compilePolicy(
  text: string,
  options: CompileOptions = {},
): Promise<ServResult<CompiledPolicy>> {
  const clauses = splitClauses(text);
  if (clauses.length === 0) {
    return { ok: false, reason: "error", message: "the policy text is empty" };
  }

  const result = await servJson({
    system: SYSTEM,
    user: `Policy, one clause per line with its index:\n\n${numbered(clauses)}`,
    schema: inferenceSchema,
    schemaName: "policy_inference",
    features: { kronos: options.kronos ?? true },
    ...(options.model ? { model: options.model } : {}),
    maxTokens: 4000,
  });

  if (!result.ok) return result;

  const known = new Set(clauses.map((c) => c.index));
  const keepKnown = (indices: number[]): number[] => indices.filter((i) => known.has(i));

  const compiled: CompiledPolicy = {
    text,
    clauses,
    // Nothing is confirmed until a human has seen it. The attack still runs,
    // but the report distinguishes a breach of a confirmed intent from a
    // breach of one LACUNA inferred on its own.
    intents: result.value.intents.map((i) => ({
      id: i.id,
      statement: i.statement,
      disposition: i.disposition,
      sourceClauses: keepKnown(i.sourceClauses),
      confidence: Math.min(1, Math.max(0, i.confidence)),
      confirmed: false,
    })),
    actions: result.value.actions,
    undefinedTerms: result.value.undefinedTerms.map((t) => ({
      term: t.term,
      why: t.why,
      sourceClauses: keepKnown(t.sourceClauses),
    })),
    openQuestions: result.value.openQuestions,
  };

  return { ok: true, value: compiled, model: result.model, usage: result.usage };
}
