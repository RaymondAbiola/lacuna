import { describe, expect, it } from "vitest";
import { blockedByGuard, modelId } from "../src/serv.js";
import { toStrictJsonSchema } from "../src/schema-json.js";
import { z } from "zod";

describe("modelId", () => {
  it("leaves a plain model alone", () => {
    expect(modelId("gpt-5.4-mini", undefined)).toBe("gpt-5.4-mini");
    expect(modelId("gpt-5.4-mini", {})).toBe("gpt-5.4-mini");
  });

  it("appends each feature suffix exactly once", () => {
    expect(modelId("gpt-5.4-mini", { kronos: true })).toBe("gpt-5.4-mini-serv-kronos");
    expect(modelId("gpt-5.4-mini", { multipath: true })).toBe("gpt-5.4-mini-serv-multipath");
  });

  it("uses the combined suffix when both are on", () => {
    expect(modelId("gpt-5.4-mini", { kronos: true, multipath: true })).toBe(
      "gpt-5.4-mini-serv-kronos-multipath",
    );
  });

  it("does not add a suffix for tool-based features", () => {
    expect(modelId("gpt-5.4-mini", { promptGuard: true, shadowAgent: {} })).toBe("gpt-5.4-mini");
  });
});

describe("blockedByGuard", () => {
  // A block is a 200 with a canned body and no token spend. Measured against
  // the live endpoint: the same request with the guard off spends ~250 input
  // tokens, so zero usage is the only reliable tell.
  it("reads zero token usage as a block when the guard is on", () => {
    expect(blockedByGuard({ promptGuard: true }, { prompt_tokens: 0, completion_tokens: 0 })).toBe(true);
  });

  it("does not call a normal answer a block", () => {
    expect(blockedByGuard({ promptGuard: true }, { prompt_tokens: 253, completion_tokens: 39 })).toBe(
      false,
    );
  });

  it("reports a block even when no feature was requested", () => {
    // The default content filter refuses without being opted into, and keying
    // off promptGuard made those refusals surface as JSON parse errors.
    expect(blockedByGuard(undefined, { prompt_tokens: 0, completion_tokens: 0 })).toBe(true);
    expect(blockedByGuard({}, { prompt_tokens: 0, completion_tokens: 0 })).toBe(true);
  });

  it("treats missing usage as zero rather than throwing", () => {
    expect(blockedByGuard({ promptGuard: true }, undefined)).toBe(true);
  });
});

describe("toStrictJsonSchema", () => {
  const schema = z.object({
    verdict: z.enum(["allow", "deny"]),
    note: z.string().min(1).max(400),
    score: z.number().min(0).max(1),
    pack: z.enum(["small", "large"]).nullable(),
  });

  const out = toStrictJsonSchema(schema, "decision") as Record<string, unknown>;
  const props = out["properties"] as Record<string, Record<string, unknown>>;

  it("strips keywords strict mode rejects", () => {
    expect(props["note"]).not.toHaveProperty("minLength");
    expect(props["note"]).not.toHaveProperty("maxLength");
    expect(props["score"]).not.toHaveProperty("minimum");
    expect(props["score"]).not.toHaveProperty("maximum");
  });

  it("closes the object and requires every field", () => {
    expect(out["additionalProperties"]).toBe(false);
    expect(out["required"]).toEqual(["verdict", "note", "score", "pack"]);
  });

  it("keeps enums, which carry the real contract", () => {
    expect(props["verdict"]?.["enum"]).toEqual(["allow", "deny"]);
  });

  it("keeps a nullable field expressible", () => {
    expect(JSON.stringify(props["pack"])).toContain("null");
  });

  it("drops the $schema key", () => {
    expect(out).not.toHaveProperty("$schema");
  });
});
