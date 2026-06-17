import { describe, expect, it } from "vitest";
import { AddonSpec, emptySpec, validateSpec } from "@/lib/spec";
import { blueprintRows, kindLabel, stepState } from "@/utils/addon-view";

const completeRecipe: AddonSpec = {
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
  title: "魔法の杖",
  description: "光る杖",
  kind: "item",
  namespace: "magic",
  outputName: "magic-wand",
  item: { identifier: "magic:wand", displayName: "魔法の杖", maxStackSize: 1 },
  unresolvedQuestions: []
};

const completeScript: AddonSpec = {
  title: "通知",
  description: "ブロック破壊で通知",
  kind: "script",
  namespace: "notify",
  outputName: "notify-pack",
  script: { event: "blockBreak", summary: "ブロックを壊すと通知", message: "壊した！" },
  unresolvedQuestions: []
};

const blockingIncomplete = (spec: AddonSpec) =>
  blueprintRows(spec).filter((r) => r.status === "current" || r.status === "pending").length;

describe("kindLabel", () => {
  it("3種を日本語化する", () => {
    expect(kindLabel("recipe")).toBe("レシピ");
    expect(kindLabel("item")).toBe("アイテム");
    expect(kindLabel("script")).toBe("スクリプト");
  });
});

describe("stepState", () => {
  it("開始前は種類がcurrent", () => {
    expect(stepState({ hasStarted: false, canBuild: false, built: false })).toEqual({
      kind: "current",
      detail: "todo",
      build: "todo"
    });
  });
  it("開始後・未完了は詳細がcurrent", () => {
    expect(stepState({ hasStarted: true, canBuild: false, built: false })).toEqual({
      kind: "done",
      detail: "current",
      build: "todo"
    });
  });
  it("生成可・未生成は生成がcurrent", () => {
    expect(stepState({ hasStarted: true, canBuild: true, built: false })).toEqual({
      kind: "done",
      detail: "done",
      build: "current"
    });
  });
  it("生成済みは全done", () => {
    expect(stepState({ hasStarted: true, canBuild: true, built: true })).toEqual({
      kind: "done",
      detail: "done",
      build: "done"
    });
  });
});

describe("blueprintRows", () => {
  it("currentは最大1つだけ", () => {
    for (const spec of [emptySpec, completeRecipe, completeItem, completeScript]) {
      const currents = blueprintRows(spec).filter((r) => r.status === "current");
      expect(currents.length).toBeLessThanOrEqual(1);
    }
  });

  it("情報行(表示名/概要)は常にinfoで非ブロッキング", () => {
    const itemInfo = blueprintRows(completeItem).find((r) => r.label === "表示名");
    expect(itemInfo?.status).toBe("info");
    const scriptInfo = blueprintRows(completeScript).find((r) => r.label === "概要");
    expect(scriptInfo?.status).toBe("info");
  });

  it("完成スペックは未完了行ゼロ", () => {
    expect(blockingIncomplete(completeRecipe)).toBe(0);
    expect(blockingIncomplete(completeItem)).toBe(0);
    expect(blockingIncomplete(completeScript)).toBe(0);
  });

  it("未入力スペックは先頭の不正行がcurrent", () => {
    const rows = blueprintRows(emptySpec);
    const firstBad = rows.find((r) => r.status === "current" || r.status === "pending");
    expect(firstBad?.status).toBe("current");
  });

  it("canBuildとの同値性: 未完了ゼロ ⇔ validateSpecが空", () => {
    const partial: AddonSpec = { ...completeRecipe, namespace: "1bad" };
    for (const spec of [emptySpec, completeRecipe, completeItem, completeScript, partial]) {
      expect(blockingIncomplete(spec) === 0).toBe(validateSpec(spec).length === 0);
    }
  });
});
