import { describe, expect, it } from "vitest";
import { buildArgs, classifyFailure, SESSION_ERRORS } from "../src/kite.js";

describe("buildArgs", () => {
  it("always asks for json and never prompts", () => {
    // Kite documents both flags as the automation path. A missing
    // --no-interactive turns an unattended run into a hung process.
    expect(buildArgs(["status"])).toEqual(["status", "--output", "json", "--no-interactive"]);
  });

  it("preserves the command and its arguments in order", () => {
    const args = buildArgs(["agent:session", "execute", "--url", "https://example.com/paid"]);
    expect(args.slice(0, 4)).toEqual([
      "agent:session",
      "execute",
      "--url",
      "https://example.com/paid",
    ]);
  });
});

describe("classifyFailure", () => {
  it("recognises a per-transaction refusal", () => {
    const f = classifyFailure({ error: { code: "session_rule_exceeded", hint: "raise per-tx" } });
    expect(f.kind).toBe("refused");
    if (f.kind === "refused") expect(f.code).toBe("session_rule_exceeded");
  });

  it("recognises an exhausted budget", () => {
    const f = classifyFailure({ code: "session_total_exceeded" });
    if (f.kind !== "refused") throw new Error("expected a refusal");
    expect(f.code).toBe("session_total_exceeded");
  });

  it("recognises an out-of-scope endpoint", () => {
    const f = classifyFailure('{"code":"session_endpoint_forbidden"}');
    if (f.kind !== "refused") throw new Error("expected a refusal");
    expect(f.code).toBe("session_endpoint_forbidden");
  });

  it("carries the hint through, because recovery depends on it", () => {
    const f = classifyFailure({ hint: "create a session with broader scope", code: "session_forbidden" });
    if (f.kind !== "refused") throw new Error("expected a refusal");
    expect(f.hint).toBe("create a session with broader scope");
  });

  it("classifies every documented session error", () => {
    for (const code of SESSION_ERRORS) {
      const f = classifyFailure({ code });
      expect(f.kind, code).toBe("refused");
    }
  });

  it("falls back to a plain error for anything unrecognised", () => {
    const f = classifyFailure({ message: "backend unreachable" });
    expect(f.kind).toBe("error");
  });

  it("does not mistake prose mentioning a limit for a refusal code", () => {
    const f = classifyFailure({ message: "the session total was close to the limit" });
    expect(f.kind).toBe("error");
  });
});

describe("describeFailure", () => {
  it("renders a refusal with its hint", async () => {
    const { describeFailure } = await import("../src/kite.js");
    expect(
      describeFailure({ kind: "refused", code: "session_total_exceeded", hint: "raise budget", raw: {} }),
    ).toBe("session_total_exceeded: raise budget");
  });

  it("renders a refusal without a hint", async () => {
    const { describeFailure } = await import("../src/kite.js");
    expect(describeFailure({ kind: "refused", code: "session_forbidden", hint: "", raw: {} })).toBe(
      "session_forbidden",
    );
  });

  it("renders a missing cli", async () => {
    const { describeFailure } = await import("../src/kite.js");
    expect(describeFailure({ kind: "cli_missing", message: "not installed" })).toBe("not installed");
  });
});
