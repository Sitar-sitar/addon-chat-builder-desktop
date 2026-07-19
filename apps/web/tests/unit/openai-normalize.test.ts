import { describe, expect, it } from "vitest";
import {
  bedrockChatResponseSchema,
  codexUserInputText,
  javaChatResponseSchema,
  normalizeRawSpec,
  toLegacyBedrockCodexSpec,
} from "../../src/lib/openai";
import type { BedrockAddonSpec } from "../../src/lib/spec";
import { emptyAction } from "./java-fixtures";

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

describe("OpenAI schemas and normalization", () => {
  it("keeps Bedrock projection keys and JSON order stable", () => {
    expect(Object.keys(toLegacyBedrockCodexSpec(bedrock))).toEqual([
      "edition",
      "title",
      "description",
      "kind",
      "namespace",
      "outputName",
      "recipe",
      "item",
      "script",
      "unresolvedQuestions",
    ]);
    expect(codexUserInputText(bedrock)).toBe(
      '{"spec":{"edition":"bedrock","title":"B","description":"D","kind":"script","namespace":"b","outputName":"b","script":{"event":"itemUse","summary":"s","message":"m"},"unresolvedQuestions":[]}}',
    );
  });
  it("separates Bedrock and Java schemas", () => {
    const bedrockSpec = (bedrockChatResponseSchema as any).properties.spec;
    const javaSpec = (javaChatResponseSchema as any).properties.spec;
    expect(bedrockSpec.required).not.toContain("unsupportedRequests");
    expect(bedrockSpec.properties.kind.enum).toEqual([
      "recipe",
      "item",
      "script",
      "resourcepack",
    ]);
    expect(javaSpec.required).toContain("unsupportedRequests");
    expect(javaSpec.properties.javaScript.properties.actions.maxItems).toBe(3);
  });
  it("normalizes Bedrock without Java fields", () => {
    const raw: any = {
      ...bedrock,
      recipe: { ingredients: [] },
      item: {},
      script: bedrock.script,
      resourcepack: { langEntries: [] },
    };
    const spec = normalizeRawSpec(raw, "bedrock");
    expect(spec.edition).toBe("bedrock");
    expect("unsupportedRequests" in spec).toBe(false);
  });
  it("does not silently truncate Java actions", () => {
    const actions = [
      emptyAction(),
      emptyAction(),
      emptyAction(),
      emptyAction(),
    ];
    const raw: any = {
      title: "J",
      description: "D",
      kind: "script",
      namespace: "j",
      outputName: "j",
      recipe: {},
      javaScript: {
        trigger: "interval",
        intervalSeconds: 60,
        condition: "always",
        actions,
        triggerItemId: "",
        triggerEntityId: "",
        triggerBlockId: "",
        summary: "",
      },
      loot: {},
      resourcepack: {},
      unresolvedQuestions: [],
      unsupportedRequests: [],
    };
    const spec = normalizeRawSpec(raw, "java");
    expect(spec.edition === "java" && spec.javaScript?.actions).toHaveLength(4);
  });
});
