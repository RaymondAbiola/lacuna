import { beforeEach, describe, expect, it } from "vitest";
import { checkGuard, clientIp, recordRun, resetGuard } from "../app/api/audit/guard";

const LIMITS = { perIpPerHour: 3, globalPerDay: 5 };
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

beforeEach(() => resetGuard());

const run = (ip: string, at: number) => {
  const verdict = checkGuard(ip, LIMITS, at);
  if (verdict.ok) recordRun(ip, at);
  return verdict;
};

describe("per-address limit", () => {
  it("allows up to the limit and then refuses", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i += 1) expect(run("1.1.1.1", t + i).ok).toBe(true);
    expect(run("1.1.1.1", t + 4).ok).toBe(false);
  });

  it("says why, rather than returning a bare refusal", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i += 1) run("1.1.1.1", t + i);
    const refused = checkGuard("1.1.1.1", LIMITS, t + 4);
    expect(refused.why).toContain("3 audits in an hour");
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("lets the same address back in once the hour has rolled", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i += 1) run("1.1.1.1", t + i);
    expect(run("1.1.1.1", t + HOUR + 1).ok).toBe(true);
  });

  it("does not punish one address for another's usage", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i += 1) run("1.1.1.1", t + i);
    expect(run("2.2.2.2", t + 4).ok).toBe(true);
  });

  it("does not count a refused request against the budget", () => {
    // Otherwise a blocked client extends its own lockout by retrying, and the
    // global budget drains on requests that never bought anything.
    const t = 1_000_000;
    for (let i = 0; i < 3; i += 1) run("1.1.1.1", t + i);
    for (let i = 0; i < 20; i += 1) run("1.1.1.1", t + 10 + i);
    expect(run("9.9.9.9", t + 100).ok).toBe(true);
  });
});

describe("daily budget", () => {
  it("stops everyone once the day's runs are spent", () => {
    const t = 2_000_000;
    for (let i = 0; i < 5; i += 1) expect(run(`10.0.0.${i}`, t + i).ok).toBe(true);
    const refused = run("10.0.0.99", t + 10);
    expect(refused.ok).toBe(false);
    expect(refused.why).toContain("budget for today");
  });

  it("points a refused visitor at the recorded runs, which are free", () => {
    const t = 2_000_000;
    for (let i = 0; i < 5; i += 1) run(`10.0.0.${i}`, t + i);
    expect(run("10.0.0.99", t + 10).why).toContain("cost nothing to read");
  });

  it("opens again after a day", () => {
    const t = 2_000_000;
    for (let i = 0; i < 5; i += 1) run(`10.0.0.${i}`, t + i);
    expect(run("10.0.0.99", t + DAY + 1).ok).toBe(true);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers });

  it("takes the first entry of a forwarded chain", () => {
    expect(clientIp(req({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("3.3.3.3");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "5.5.5.5" }))).toBe("5.5.5.5");
  });

  it("buckets requests with no address together rather than exempting them", () => {
    // "unknown" is a bucket, not a bypass: without this, stripping the header
    // would be the way around the per-address limit.
    expect(clientIp(req({}))).toBe("unknown");
  });
});
