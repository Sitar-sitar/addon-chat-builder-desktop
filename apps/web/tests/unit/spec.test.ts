import { describe, expect, it } from "vitest";
import { AddonSpec, validateSpec } from "@/lib/spec";

function javaScript(intervalSeconds: number, event: "interval" | "itemUse" = "interval"): AddonSpec {
  return {
    edition: "java",
    title: "通知",
    description: "定期通知",
    kind: "script",
    namespace: "notify",
    outputName: "notify",
    script: { event, summary: "通知", message: "休憩", intervalSeconds },
    unresolvedQuestions: []
  };
}

function javaRecipe(pattern: string[], key: Record<string, string>): AddonSpec {
  return {
    edition: "java",
    title: "レシピ",
    description: "確認用レシピ",
    kind: "recipe",
    namespace: "recipes",
    outputName: "recipe",
    recipe: { resultItem: "minecraft:stick", resultCount: 1, pattern, key },
    unresolvedQuestions: []
  };
}

describe("validateSpec Java版", () => {
  it.each([
    [4, false],
    [5, true],
    [3600, true],
    [3601, false]
  ])("intervalSeconds=%s", (seconds, valid) => {
    expect(validateSpec(javaScript(seconds)).length === 0).toBe(valid);
  });

  it("itemとitemUseを拒否する", () => {
    const item: AddonSpec = {
      edition: "java",
      title: "杖",
      description: "杖を追加",
      kind: "item",
      namespace: "wand",
      outputName: "wand",
      item: { identifier: "wand:item", displayName: "杖", maxStackSize: 1 },
      unresolvedQuestions: []
    };
    expect(validateSpec(item)).toContain("Java版ではアイテム追加はデータパックで実現できません（Mod が必要です）。");
    expect(validateSpec(javaScript(60, "itemUse"))).toContain("Java版の script は interval のみ対応です。");
  });

  it("Javaレシピはminecraft: IDだけを許可する", () => {
    const spec: AddonSpec = {
      edition: "java",
      title: "レシピ",
      description: "剣のレシピ",
      kind: "recipe",
      namespace: "recipes",
      outputName: "sword",
      recipe: { resultItem: "custom:sword", resultCount: 1, pattern: ["#"], key: { "#": "custom:gem" } },
      unresolvedQuestions: []
    };
    expect(validateSpec(spec)).toEqual(expect.arrayContaining([
      "Java版の完成アイテムは minecraft: のバニラIDにしてください。",
      "Java版のレシピ素材は minecraft: のバニラIDにしてください。"
    ]));
  });

  it.each([
    {
      name: "行幅不一致",
      spec: javaRecipe(["#", "##"], { "#": "minecraft:diamond" }),
      error: "Java版のレシピパターンは全行を同じ幅にしてください。"
    },
    {
      name: "空行",
      spec: javaRecipe([""], { "#": "minecraft:diamond" }),
      error: "Java版のレシピパターンは各行1から3文字にしてください。"
    },
    {
      name: "4文字行",
      spec: javaRecipe(["####"], { "#": "minecraft:diamond" }),
      error: "Java版のレシピパターンは各行1から3文字にしてください。"
    },
    {
      name: "未定義記号",
      spec: javaRecipe(["X"], { "#": "minecraft:diamond" }),
      error: "Java版のレシピパターンで未定義の素材記号を使用しています。"
    },
    {
      name: "複数文字key",
      spec: javaRecipe(["#"], { "##": "minecraft:diamond" }),
      error: "Java版のレシピ素材記号は1文字で指定してください。"
    }
  ])("Javaレシピのpattern/key整合を検証する: $name", ({ spec, error }) => {
    expect(validateSpec(spec)).toContain(error);
  });

  it("pattern内の空白は素材記号として扱わない", () => {
    expect(validateSpec(javaRecipe([" #", "# "], { "#": "minecraft:diamond" }))).toEqual([]);
  });

  it("langEntriesの不正key・空value・重複を拒否する", () => {
    const spec: AddonSpec = {
      edition: "java",
      title: "名前変更",
      description: "表示名を変更",
      kind: "resourcepack",
      namespace: "names",
      outputName: "names",
      resourcepack: {
        langEntries: [
          { key: "other.key", value: "" },
          { key: "other.key", value: "名前" }
        ]
      },
      unresolvedQuestions: []
    };
    const errors = validateSpec(spec);
    expect(errors).toEqual(expect.arrayContaining([
      "lang のキーは item.minecraft.* または block.minecraft.* の形にしてください。",
      "lang の表示名は空にできません。",
      "lang のキーが重複しています: other.key"
    ]));
  });

  it("Bedrockのresourcepackを拒否する", () => {
    const spec: AddonSpec = {
      edition: "bedrock",
      title: "名前変更",
      description: "表示名を変更",
      kind: "resourcepack",
      namespace: "names",
      outputName: "names",
      resourcepack: { langEntries: [{ key: "item.minecraft.stick", value: "棒" }] },
      unresolvedQuestions: []
    };
    expect(validateSpec(spec)).toContain("リソースパックは Java版のみ対応です。");
  });
});
