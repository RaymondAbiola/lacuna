import type { AttackCase } from "@lacuna/core";

// Two cases that are the same attack in different words waste a model call
// each and inflate the finding count, which would make a policy look worse
// than it is. Signature is deterministic so a re-run dedupes identically.
export function signature(c: Pick<AttackCase, "family" | "scenario" | "request">): string {
  const normalise = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\b(the|a|an|is|are|of|to|for|and|or|that|this|it)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return `${c.family}::${normalise(c.scenario)}::${normalise(c.request)}`;
}

export function dedupeCases(cases: AttackCase[]): AttackCase[] {
  const seen = new Set<string>();
  const kept: AttackCase[] = [];

  for (const c of cases) {
    const sig = signature(c);
    if (seen.has(sig)) continue;
    seen.add(sig);
    kept.push(c);
  }
  return kept;
}

// Re-index after filtering so ids stay contiguous and readable in a report.
export function reindex(cases: AttackCase[], prefix: string): AttackCase[] {
  return cases.map((c, i) => ({ ...c, id: `${prefix}-${i}` }));
}
