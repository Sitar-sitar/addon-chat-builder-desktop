import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAddonFilesWithCodex,
  refineAddonSpec,
} from "../../src/lib/openai";
import type { BedrockAddonSpec } from "../../src/lib/spec";

const bedrock: BedrockAddonSpec = {
  edition: "bedrock",
  title: "B",
  description: "D",
  kind: "script",
  namespace: "b",
  outputName: "b",
  script: { event: "itemUse", summary: "s", message: "m" },
  unresolvedQuestions: [],
};

const chatSuccessBody = {
  output_text: JSON.stringify({
    assistantMessage: "ok",
    spec: {
      edition: "bedrock",
      title: "T",
      description: "D",
      kind: "script",
      namespace: "b",
      outputName: "b",
      recipe: { ingredients: [] },
      item: {},
      script: { event: "itemUse", summary: "s", message: "m" },
      resourcepack: { langEntries: [] },
      unresolvedQuestions: [],
    },
    suggestedReplies: [],
    recommendedReply: "",
  }),
};
const codexSuccessBody = {
  output_text: JSON.stringify({
    files: [{ path: "manifest.json", content: "{}" }],
  }),
};

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}
function timeoutRejection(): Promise<never> {
  return Promise.reject(
    new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError",
    ),
  );
}

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_CHAT_MODEL",
  "OPENAI_CHAT_FALLBACK_MODELS",
  "OPENAI_CODE_MODEL",
  "OPENAI_CODE_FALLBACK_MODELS",
] as const;
const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;
const originalFetch = global.fetch;

describe("OpenAI fetch timeout and fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.OPENAI_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("retries chat requests against a fallback model with a fresh signal after a primary timeout", async () => {
    process.env.OPENAI_CHAT_MODEL = "primary-chat";
    process.env.OPENAI_CHAT_FALLBACK_MODELS = "fallback-chat";
    const calls: RequestInit[] = [];
    global.fetch = vi.fn((_url: unknown, init: RequestInit) => {
      calls.push(init);
      return calls.length === 1
        ? timeoutRejection()
        : Promise.resolve(okResponse(chatSuccessBody));
    }) as unknown as typeof fetch;

    const result = await refineAddonSpec({
      messages: [{ role: "user", content: "hi" }],
      edition: "bedrock",
    });

    expect(result.assistantMessage).toBe("ok");
    expect(calls).toHaveLength(2);
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(calls[1].signal).toBeInstanceOf(AbortSignal);
    expect(calls[0].signal).not.toBe(calls[1].signal);
  });

  it("fails chat requests with a labeled error when every model times out", async () => {
    process.env.OPENAI_CHAT_MODEL = "primary-chat";
    process.env.OPENAI_CHAT_FALLBACK_MODELS = "fallback-chat";
    global.fetch = vi.fn(() => timeoutRejection()) as unknown as typeof fetch;

    await expect(
      refineAddonSpec({
        messages: [{ role: "user", content: "hi" }],
        edition: "bedrock",
      }),
    ).rejects.toThrow("OpenAI API エラー");
  });

  it("retries Codex requests against a fallback model with a fresh signal after a primary timeout", async () => {
    process.env.OPENAI_CODE_MODEL = "primary-codex";
    process.env.OPENAI_CODE_FALLBACK_MODELS = "fallback-codex";
    const calls: RequestInit[] = [];
    global.fetch = vi.fn((_url: unknown, init: RequestInit) => {
      calls.push(init);
      return calls.length === 1
        ? timeoutRejection()
        : Promise.resolve(okResponse(codexSuccessBody));
    }) as unknown as typeof fetch;

    const files = await generateAddonFilesWithCodex(bedrock);

    expect(files).toEqual([{ path: "manifest.json", content: "{}" }]);
    expect(calls).toHaveLength(2);
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(calls[1].signal).toBeInstanceOf(AbortSignal);
    expect(calls[0].signal).not.toBe(calls[1].signal);
  });

  it("fails Codex requests with a labeled error when every model times out", async () => {
    process.env.OPENAI_CODE_MODEL = "primary-codex";
    process.env.OPENAI_CODE_FALLBACK_MODELS = "fallback-codex";
    global.fetch = vi.fn(() => timeoutRejection()) as unknown as typeof fetch;

    await expect(generateAddonFilesWithCodex(bedrock)).rejects.toThrow(
      "Codex API エラー",
    );
  });
});
