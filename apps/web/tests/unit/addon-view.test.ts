import { describe, expect, it } from "vitest";
import { AddonSpec, createEmptySpec, validateSpec } from "@/lib/spec";
import { blueprintRows, kindLabel, stepState } from "@/utils/addon-view";

const completeRecipe: AddonSpec = {
  edition: "bedrock",
  title: "雷の槍",
  description: "雷を出せる槍のレシピ",
  kind: "recipe",
  namespace: "thunder_spear",
  outputName: "thunder-spear",
  recipe: {
    resultItem: "thunder:spear",
    resultCount: 4,
    pattern: ["#", "|", "|"],
    key: { "#": "minecraft:iron_ingot", "|": "minecraft:stick" }
  },
  unresolvedQuestions: []
};

const completeItem: AddonSpec = {
  edition: "bedrock",
  title: "魔法の杖",
  description: "光る杖",
  kind: "item",
  namespace: "magic",
  outputName: "magic-wand",
  item: { identifier: "magic:wand", displayName: "魔法の杖", maxStackSize: 1 },
  unresolvedQuestions: []
};

const completeScript: AddonSpec = {
  edition: "bedrock",
  title: "通知",
  description: "ブロック破壊で通知",
  kind: "script",
  namespace: "notify",
  outputName: "notify-pack",
  script: { event: "blockBreak", summary: "ブロックを壊すと通知", message: "壊した！" },
  unresolvedQuestions: []
};

const javaScript: AddonSpec = {
  ...completeScript,
  edition: "java",
  description: "60秒ごとに通知",
  script: { event: "interval", summary: "定期通知", message: "休憩しよう", intervalSeconds: 60 }
};

const resourcepack: AddonSpec = {
  edition: "java",
  title: "表示名変更",
  description: "ダイヤ剣の名前を変更",
  kind: "resourcepack",
  namespace: "rename_items",
  outputName: "rename-items",
  resourcepack: { langEntries: [{ key: "item.minecraft.diamond_sword", value: "伝説の剣" }] },
  unresolvedQuestions: []
};

const malformedJavaRecipe: AddonSpec = {
  ...completeRecipe,
  edition: "java",
  recipe: {
    resultItem: "minecraft:stick",
    resultCount: 1,
    pattern: ["#", "##"],
    key: { "#": "minecraft:diamond" }
  }
};

const blockingIncomplete = (spec: AddonSpec) =>
  blueprintRows(spec, "1.21.5").filter((row) => row.status === "current" || row.status === "pending").length;

describe("kindLabel", () => {
  it("4種を日本語化する", () => {
    expect(kindLabel("recipe")).toBe("レシピ");
    expect(kindLabel("item")).toBe("アイテム");
    expect(kindLabel("script")).toBe("スクリプト");
    expect(kindLabel("resourcepack")).toBe("リソースパック");
  });
});

describe("stepState", () => {
  it("4状態を返す", () => {
    expect(stepState({ hasStarted: false, canBuild: false, built: false })).toEqual({ kind: "current", detail: "todo", build: "todo" });
    expect(stepState({ hasStarted: true, canBuild: false, built: false })).toEqual({ kind: "done", detail: "current", build: "todo" });
    expect(stepState({ hasStarted: true, canBuild: true, built: false })).toEqual({ kind: "done", detail: "done", build: "current" });
    expect(stepState({ hasStarted: true, canBuild: true, built: true })).toEqual({ kind: "done", detail: "done", build: "done" });
  });
});

describe("blueprintRows", () => {
  it("currentは最大1つで、情報行は非ブロッキング", () => {
    for (const spec of [createEmptySpec(), completeRecipe, completeItem, completeScript, javaScript, resourcepack]) {
      expect(blueprintRows(spec, "1.21.5").filter((row) => row.status === "current").length).toBeLessThanOrEqual(1);
    }
    expect(blueprintRows(completeItem).find((row) => row.label === "表示名")?.status).toBe("info");
    expect(blueprintRows(completeScript).find((row) => row.label === "概要")?.status).toBe("info");
  });

  it("Java版のエディション・パック種別・間隔を表示する", () => {
    const rows = blueprintRows(javaScript, "1.21.5");
    expect(rows.slice(0, 2)).toEqual([
      { label: "エディション", value: "Java版（1.21.5）", status: "info" },
      { label: "パック種別", value: "データパック", status: "info" }
    ]);
    expect(rows.find((row) => row.label === "間隔")?.value).toBe("60秒");
  });

  it("未完了ゼロとvalidateSpec成功が同値", () => {
    const partial: AddonSpec = { ...completeRecipe, namespace: "1bad" };
    for (const spec of [
      createEmptySpec(),
      completeRecipe,
      completeItem,
      completeScript,
      javaScript,
      resourcepack,
      malformedJavaRecipe,
      partial
    ]) {
      expect(blockingIncomplete(spec) === 0).toBe(validateSpec(spec).length === 0);
    }
  });
});
