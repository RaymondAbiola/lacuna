import { createHash, randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import {
  type AttackCase,
  type CompiledPolicy,
  type Decision,
  type Finding,
  type Run,
  type Score,
  type Target as TargetDescription,
} from "@lacuna/core";

export type Store = InstanceType<typeof Database>;

export function policyHash(text: string): string {
  // Whitespace-insensitive, so a reflowed paragraph is still the same policy
  // and still hits the compile cache.
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 32);
}

export function openStore(path: string): Store {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS policies (
      hash       TEXT PRIMARY KEY,
      text       TEXT NOT NULL,
      compiled   TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id          TEXT PRIMARY KEY,
      policy_hash TEXT NOT NULL,
      started_at  TEXT NOT NULL,
      finished_at TEXT,
      target      TEXT NOT NULL,
      cases       TEXT NOT NULL,
      decisions   TEXT NOT NULL,
      findings    TEXT NOT NULL,
      score       TEXT NOT NULL,
      label       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_runs_policy ON runs(policy_hash, started_at DESC);
  `);
  return db;
}

// Compiling a policy is one of the more expensive calls in a run, and the same
// text compiles to the same structure, so the cache is both a cost saving and
// a guarantee that a re-run judges against identical clause indices.
export function cachedCompile(db: Store, text: string): CompiledPolicy | undefined {
  const row = db.prepare("SELECT compiled FROM policies WHERE hash = ?").get(policyHash(text)) as
    | { compiled: string }
    | undefined;
  return row ? (JSON.parse(row.compiled) as CompiledPolicy) : undefined;
}

export function putCompiled(db: Store, policy: CompiledPolicy): void {
  db.prepare(
    `INSERT INTO policies (hash, text, compiled, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(hash) DO UPDATE SET compiled = excluded.compiled`,
  ).run(policyHash(policy.text), policy.text, JSON.stringify(policy), new Date().toISOString());
}

export interface SaveRunInput {
  policy: CompiledPolicy;
  target: TargetDescription;
  cases: AttackCase[];
  decisions: Decision[];
  findings: Finding[];
  score: Score;
  startedAt: string;
  label?: string;
}

export function saveRun(db: Store, input: SaveRunInput): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO runs (id, policy_hash, started_at, finished_at, target, cases, decisions, findings, score, label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    policyHash(input.policy.text),
    input.startedAt,
    new Date().toISOString(),
    JSON.stringify(input.target),
    JSON.stringify(input.cases),
    JSON.stringify(input.decisions),
    JSON.stringify(input.findings),
    JSON.stringify(input.score),
    input.label ?? null,
  );
  return id;
}

interface RunRow {
  id: string;
  policy_hash: string;
  started_at: string;
  finished_at: string | null;
  target: string;
  cases: string;
  decisions: string;
  findings: string;
  score: string;
}

export interface StoredRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  target: TargetDescription;
  cases: AttackCase[];
  decisions: Decision[];
  findings: Finding[];
  score: Score;
}

function hydrate(row: RunRow): StoredRun {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    target: JSON.parse(row.target) as TargetDescription,
    cases: JSON.parse(row.cases) as AttackCase[],
    decisions: JSON.parse(row.decisions) as Decision[],
    findings: JSON.parse(row.findings) as Finding[],
    score: JSON.parse(row.score) as Score,
  };
}

// The case set from the previous run of the same policy. Replaying it is what
// makes a before-and-after comparison mean anything: measuring a patch against
// freshly generated attacks compares two different experiments.
export function previousRun(db: Store, text: string): StoredRun | undefined {
  const row = db
    .prepare("SELECT * FROM runs WHERE policy_hash = ? ORDER BY started_at DESC LIMIT 1")
    .get(policyHash(text)) as RunRow | undefined;
  return row ? hydrate(row) : undefined;
}

export function getRun(db: Store, id: string): StoredRun | undefined {
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
  return row ? hydrate(row) : undefined;
}

export function listRuns(db: Store, limit = 20): StoredRun[] {
  const rows = db
    .prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?")
    .all(limit) as RunRow[];
  return rows.map(hydrate);
}

export function toRun(stored: StoredRun, policy: CompiledPolicy): Run {
  return {
    id: stored.id,
    startedAt: stored.startedAt,
    finishedAt: stored.finishedAt,
    policy: {
      id: policyHash(policy.text),
      name: "policy",
      text: policy.text,
      intents: policy.intents,
      actions: policy.actions,
      hardLimits: {},
    },
    target: stored.target,
    cases: stored.cases,
    decisions: stored.decisions,
    findings: stored.findings,
  };
}
