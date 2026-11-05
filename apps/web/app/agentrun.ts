import raw from "./agentrun.json";
import type { Showcase } from "./showcase";

// The third recorded run, and the only one taken against a deployed agent
// rather than a policy on its own: a payments agent holding a Kite spending
// session, audited over HTTP. Its finding moved $22.80, which is under every
// cap that agent runs behind, so nothing outside the prose was ever going to
// catch it.
export const agentRun = raw as Showcase;
