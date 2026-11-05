import { describe, expect, it } from "vitest";
import { NO_LIMITS, readLimits, toHardLimits } from "../src/limits.js";

describe("readLimits", () => {
  it("reads the shape kpass returns today", () => {
    const limits = readLimits(
      {
        sessions: [
          {
            id: "agent_session_01",
            delegation: { spending_limits: { max_amount_per_tx: 0.1, max_total_amount: 0.5 } },
            usage: { spent_total: 0.02 },
          },
        ],
      },
      "https://passport.staging.gokite.ai",
    );

    expect(limits).toEqual({
      sessionId: "agent_session_01",
      perTransaction: 0.1,
      perSession: 0.5,
      spentSoFar: 0.02,
      backend: "https://passport.staging.gokite.ai",
    });
  });

  it("reads limits that are not nested under a delegation", () => {
    // Kite has moved these fields between releases before.
    const limits = readLimits({
      sessions: [{ session_id: "s2", spending_limits: { maxAmountPerTx: 5, maxTotalAmount: 25 } }],
    });
    expect(limits.sessionId).toBe("s2");
    expect(limits.perTransaction).toBe(5);
    expect(limits.perSession).toBe(25);
  });

  it("reads amounts that arrive as strings", () => {
    const limits = readLimits({
      sessions: [{ id: "s3", spending_limits: { max_amount_per_tx: "0.25" } }],
    });
    expect(limits.perTransaction).toBe(0.25);
  });

  it("reports no limits when there is no active session", () => {
    // Honest rather than convenient: it means this agent cannot show a cap,
    // not that it is running without one.
    expect(readLimits({ sessions: [] })).toEqual(NO_LIMITS);
    expect(readLimits(null)).toEqual(NO_LIMITS);
    expect(readLimits({ sessions: [{ id: "s" }] }).perTransaction).toBeNull();
  });

  it("does not turn an unparseable amount into zero", () => {
    // Zero would read as "this agent may spend nothing", which is a stronger
    // claim than the data supports and would mute every finding.
    const limits = readLimits({
      sessions: [{ id: "s", spending_limits: { max_amount_per_tx: "later" } }],
    });
    expect(limits.perTransaction).toBeNull();
  });
});

describe("toHardLimits", () => {
  it("names the caps the way the policy schema expects", () => {
    expect(
      toHardLimits({
        sessionId: "s",
        perTransaction: 5,
        perSession: 25,
        spentSoFar: 0,
        backend: null,
      }),
    ).toEqual({ kite_per_transaction: 5, kite_per_session: 25 });
  });

  it("omits a cap it does not know rather than inventing one", () => {
    expect(toHardLimits(NO_LIMITS)).toEqual({});
  });
});
