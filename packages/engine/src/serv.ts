import OpenAI from "openai";
import type { ZodTypeAny, z } from "zod";
import { loadRootEnv, requireEnv } from "./env.js";
import { toStrictJsonSchema } from "./schema-json.js";

const BASE_URL = "https://inference-api.openserv.ai/v1";

loadRootEnv(import.meta.url);

export interface ServFeatures {
  // Model-ID suffixes. Kronos audits and repairs the generated reasoning
  // prompt before inference, which is the feature that matters most here.
  kronos?: boolean;
  multipath?: boolean;
  // serv_* tools. SERV strips them before the model runs.
  promptGuard?: boolean;
  disableContentFilter?: boolean;
  shadowAgent?: { hint?: string; maxIterations?: number };
}

export interface ServRequest {
  system: string;
  user: string;
  model?: string;
  features?: ServFeatures;
  reasoningEffort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface ServUsage {
  input: number;
  output: number;
}

export type ServResult<T> =
  | { ok: true; value: T; model: string; usage: ServUsage }
  // The guard fired: SERV refused before calling the model. For this tool that
  // is a finding about the input, not a failure of the request.
  | { ok: false; reason: "guard_blocked"; message: string }
  | { ok: false; reason: "invalid_output"; message: string; raw: string }
  | { ok: false; reason: "error"; message: string };

let client: OpenAI | undefined;

function serv(): OpenAI {
  client ??= new OpenAI({
    apiKey: requireEnv("SERV_API_KEY"),
    baseURL: BASE_URL,
    maxRetries: 2,
    timeout: 120_000,
  });
  return client;
}

export function defaultModel(): string {
  return process.env["SERV_MODEL"] ?? "gpt-5.4-mini";
}

// Kronos and Multipath are model features, appended to a real catalog model ID
// exactly once, not tools.
export function modelId(base: string, features: ServFeatures | undefined): string {
  if (features?.kronos && features.multipath) return `${base}-serv-kronos-multipath`;
  if (features?.kronos) return `${base}-serv-kronos`;
  if (features?.multipath) return `${base}-serv-multipath`;
  return base;
}

// SERV reads configuration from schema defaults rather than call-time
// arguments, because the model never sees these tools.
function servTools(features: ServFeatures | undefined): OpenAI.Chat.ChatCompletionTool[] {
  const tools: OpenAI.Chat.ChatCompletionTool[] = [];
  if (!features) return tools;

  if (features.promptGuard) {
    tools.push({ type: "function", function: { name: "serv_prompt_guard" } });
  }
  if (features.disableContentFilter) {
    tools.push({ type: "function", function: { name: "serv_disable_content_filter" } });
  }
  if (features.shadowAgent) {
    const properties: Record<string, unknown> = {};
    if (features.shadowAgent.hint !== undefined) {
      properties["hint"] = { type: "string", default: features.shadowAgent.hint };
    }
    properties["max_iterations"] = {
      type: "integer",
      default: features.shadowAgent.maxIterations ?? 3,
    };
    tools.push({
      type: "function",
      function: {
        name: "serv_shadow_agent",
        parameters: { type: "object", properties },
      },
    });
  }
  return tools;
}

// A SERV-side refusal arrives as a normal 200 with a canned body, not as an
// error. The only reliable tell is that the upstream model never ran, so both
// token counts are zero. Measured, not documented: an identical request that
// is not refused spends hundreds of input tokens, and the canned wording is
// otherwise indistinguishable from a model-authored refusal.
//
// This is deliberately independent of which feature was requested. The prompt
// guard is one source; the default content filter is another and fires even
// when nothing was opted into. Keying off promptGuard meant a filtered
// response fell through to JSON parsing and surfaced as a parse error, which
// told us nothing about what had happened.
export function blockedByGuard(
  _features: ServFeatures | undefined,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
): boolean {
  return (usage?.prompt_tokens ?? 0) === 0 && (usage?.completion_tokens ?? 0) === 0;
}

// Kept as a fallback in case SERV ever surfaces a block as an error instead.
function isGuardError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /prompt_guard|prompt guard|injection|protected instruction/i.test(message);
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function servText(request: ServRequest): Promise<ServResult<string>> {
  const model = modelId(request.model ?? defaultModel(), request.features);
  const tools = servTools(request.features);

  try {
    const completion = await serv().chat.completions.create({
      model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      ...(tools.length > 0 ? { tools } : {}),
      ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
      ...(request.maxTokens ? { max_completion_tokens: request.maxTokens } : {}),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return { ok: false, reason: "error", message: "SERV returned no content" };

    if (blockedByGuard(request.features, completion.usage)) {
      return { ok: false, reason: "guard_blocked", message: content };
    }

    return {
      ok: true,
      value: content,
      model: completion.model,
      usage: {
        input: completion.usage?.prompt_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    if (isGuardError(err)) return { ok: false, reason: "guard_blocked", message: describe(err) };
    return { ok: false, reason: "error", message: describe(err) };
  }
}

export async function servJson<S extends ZodTypeAny>(
  request: ServRequest & { schema: S; schemaName: string },
): Promise<ServResult<z.infer<S>>> {
  const model = modelId(request.model ?? defaultModel(), request.features);
  const tools = servTools(request.features);

  try {
    const completion = await serv().chat.completions.create({
      model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      ...(tools.length > 0 ? { tools } : {}),
      ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
      ...(request.maxTokens ? { max_completion_tokens: request.maxTokens } : {}),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: toStrictJsonSchema(request.schema, request.schemaName),
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { ok: false, reason: "error", message: "SERV returned no content" };

    if (blockedByGuard(request.features, completion.usage)) {
      return { ok: false, reason: "guard_blocked", message: raw };
    }

    const parsed = request.schema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { ok: false, reason: "invalid_output", message: parsed.error.message, raw };
    }

    return {
      ok: true,
      value: parsed.data,
      model: completion.model,
      usage: {
        input: completion.usage?.prompt_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    if (isGuardError(err)) return { ok: false, reason: "guard_blocked", message: describe(err) };
    return { ok: false, reason: "error", message: describe(err) };
  }
}
