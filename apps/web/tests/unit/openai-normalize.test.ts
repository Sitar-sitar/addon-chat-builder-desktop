import { describe, expect, it } from "vitest";
import { chatResponseSchema, normalizeRawSpec } from "@/lib/openai";

const raw = {
  edition: "bedrock" as const,
  title: "名前変更",
  description: "表示名変更",
  kind: "resourcepack" as const,
  namespace: "names",
  outputName: "names",
  recipe: { resultItem: "minecraft:stick", resultCount: 1, pattern: ["#"], ingredients: [{ symbol: "#", item: "minecraft:stone" }] },
  item: { identifier: "test:item", displayName: "item", maxStackSize: 1 },
  script: { event: "interval" as const, summary: "summary", message: "message", intervalSeconds: 60 },
  resourcepack: { langEntries: [{ key: " item.minecraft.stick ", value: " 棒 " }] },
  unresolvedQuestions: []
};

describe("normalizeRawSpec edition lock", () => {
  it("構造化出力でJavaリソースパックを許可する", () => {
    expect(chatResponseSchema.properties.spec.properties.kind.enum).toContain("resourcepack");
  });

  it("モデルeditionをJavaへ上書きし非対象セクションを消す", () => {
    const result = normalizeRawSpec(raw, "java");
    expect(result.edition).toBe("java");
    expect(result.item).toBeUndefined();
    expect(result.recipe).toBeUndefined();
    expect(result.script).toBeUndefined();
    expect(result.resourcepack).toEqual({ langEntries: [{ key: "item.minecraft.stick", value: "棒" }] });
  });

  it("Bedrockではresourcepackを消す", () => {
    expect(normalizeRawSpec(raw, "bedrock").resourcepack).toBeUndefined();
  });
});
