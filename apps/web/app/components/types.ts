export interface Finding {
  id: string;
  kind: string;
  severity: string;
  summary: string;
  adjudication: string;
  implicatedText: string[];
  scenario: string;
  request: string;
  verdict: string;
  amount: number | null;
  reasoning: string;
}

export interface Score {
  casesRun: number;
  findings: number;
  integrity: number;
  coverage: number;
  exposure: number;
  intentsProbed: number;
  intentsBreached: number;
  intentsTotal: number;
}

export interface Commitment {
  id: string;
  statement: string;
  disposition: string;
  stated: boolean;
  breached: boolean;
}

export interface ReplayDelta {
  fixed: string[];
  regressed: string[];
  persisted: string[];
  exposure: number;
}

export interface Result {
  runId: string;
  // Present when these attacks came from an earlier run rather than being
  // written fresh for this one.
  replayedFrom?: string | null;
  replayDelta?: ReplayDelta | null;
  score: Score;
  inconclusive: { inconclusive: boolean; why: string };
  intents: Commitment[];
  undefinedTerms: { term: string; why: string }[];
  openQuestions: string[];
  findings: Finding[];
  held: { id: string; family: string; why: string }[];
}
