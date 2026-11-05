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
      label       TEXT,
      hard_limits TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_runs_policy ON runs(policy_hash, started_at DESC);
  `);

  /*
   * Added after the first stores were written. SQLite has no "ADD COLUMN IF
   * NOT EXISTS", so this asks what the table already has rather than relying
   * on a thrown error to mean the right thing.
   */
  const columns = db.prepare("PRAGMA table_info(runs)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "hard_limits")) {
    db.exec("ALTER TABLE runs ADD COLUMN hard_limits TEXT");
  }

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
  /*
   * Caps the host enforces outside the prose, read from the agent under test.
   * Stored with the run so a report written later can still say whether a
   * finding would have been stopped by something other than the wording.
   */
  hardLimits?: Record<string, number>;
}

export function saveRun(db: Store, input: SaveRunInput): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO runs (id, policy_hash, started_at, finished_at, target, cases, decisions, findings, score, label, hard_limits)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    JSON.stringify(input.hardLimits ?? {}),
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
  hard_limits: string | null;
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
  hardLimits: Record<string, number>;
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
    hardLimits: row.hard_limits
      ? (JSON.parse(row.hard_limits) as Record<string, number>)
      : {},
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
      hardLimits: stored.hardLimits,
    },
    target: stored.target,
    cases: stored.cases,
    decisions: stored.decisions,
    findings: stored.findings,
  };
}

/*
 * A run by id, whatever policy it was taken against.
 *
 * previousRun finds a run for the same policy text, which is what replaying an
 * unchanged policy needs. This is for the other case: you edited the rule and
 * want the OLD attacks put to the NEW wording. The text hash no longer
 * matches, so the run has to be asked for by name.
 */
export function runById(db: Store, id: string): StoredRun | undefined {
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
  return row ? hydrate(row) : undefined;
}
