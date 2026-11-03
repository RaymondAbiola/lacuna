import { z } from "zod";

export const clauseSchema = z.object({
  // Stable position, so a finding can cite a clause and the author can find it.
  index: z.number().int().nonnegative(),
  // Verbatim. Never normalised, because the author has to see their own words.
  text: z.string().min(1),
  // A list item carries different weight from a sentence buried in a
  // paragraph, and silence in an enumerated list is more telling.
  form: z.enum(["list_item", "sentence"]),
});

export type Clause = z.infer<typeof clauseSchema>;

const LIST_MARKER = /^\s*(?:[-*•]|\(?\d+[.)]|[a-z][.)])\s+/i;

// Sentence splitting that leaves common abbreviations and decimals alone,
// since policies are full of "$5.00" and "e.g.".
const ABBREVIATIONS = ["e.g.", "i.e.", "etc.", "vs.", "approx.", "no.", "inc.", "ltd."];

function splitSentences(block: string): string[] {
  const guarded = ABBREVIATIONS.reduce(
    (acc, abbr) => acc.split(abbr).join(abbr.replace(/\./g, "\u0001")),
    block,
    // Decimals next: 5.00 must not become two sentences.
  ).replace(/(\d)\.(\d)/g, "$1\u0002$2");

  return guarded
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\u0001/g, ".").replace(/\u0002/g, ".").trim())
    .filter((s) => s.length > 0);
}

// Deterministic on purpose. Clause identity has to survive a re-run or a
// finding cannot be compared across runs, so the model never does this.
export function splitClauses(text: string): Clause[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const clauses: Clause[] = [];

  for (const block of blocks) {
    if (LIST_MARKER.test(block)) {
      clauses.push({ index: clauses.length, text: block, form: "list_item" });
      continue;
    }
    for (const sentence of splitSentences(block)) {
      clauses.push({ index: clauses.length, text: sentence, form: "sentence" });
    }
  }

  return clauses;
}
