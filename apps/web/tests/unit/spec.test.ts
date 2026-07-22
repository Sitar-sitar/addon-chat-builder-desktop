import { describe, expect, it } from "vitest";
import { JAVA_VERSIONS } from "../../src/lib/pack-rules";
import {
  MC_ID,
  MC_PATH_ID,
  MC_SOUND_ID,
  objectiveName,
  specChecks,
  validateSpec,
  type BedrockAddonSpec,
} from "../../src/lib/spec";
import {
  caps,
  emptyAction,
  javaScriptSpec,
  javaSpec,
  shapedRecipe,
} from "./java-fixtures";

describe("spec validation", () => {
  it("keeps Bedrock validation independent from Java capabilities", () => {
    const spec: BedrockAddonSpec = {
      edition: "bedrock",
      title: "B",
      description: "D",
      kind: "script",
      namespace: "bedrock",
      outputName: "bedrock",
      script: { event: "itemUse", summary: "s", message: "m" },
      unresolvedQuestions: [],
    };
    expect(validateSpec(spec)).toEqual([]);
  });
  it("validates namespace, ids and objective names", () => {
    expect(MC_ID.test("minecraft:stone")).toBe(true);
    expect(MC_ID.test("minecraft:a/b")).toBe(false);
    expect(MC_SOUND_ID.test("minecraft:block.note.bell")).toBe(true);
    expect(MC_PATH_ID.test("minecraft:../stone")).toBe(false);
    expect(objectiveName("test_pack", "mineBlock", "minecraft:stone")).toMatch(
      /^acb_[a-f0-9]{11}$/,
    );
    expect(
      objectiveName("test_pack", "mineBlock", "minecraft:stone"),
    ).toHaveLength(15);
  });
  it("enforces interval action and effect boundaries", () => {
    expect(
      validateSpec(
        javaScriptSpec({
          condition: "night",
          actions: [{ ...emptyAction("effect"), effectSeconds: 75 }],
        }),
        caps(),
        JAVA_VERSIONS["1.21.7"],
      ),
    ).toEqual([]);
    expect(
      validateSpec(
        javaScriptSpec({
          actions: [{ ...emptyAction("effect"), effectSeconds: 74 }],
        }),
        caps(),
        JAVA_VERSIONS["1.21.7"],
      ).join(),
    ).toContain("+15秒");
    expect(
      validateSpec(
        javaScriptSpec({ actions: [] }),
        caps(),
        JAVA_VERSIONS["1.21.7"],
      ).join(),
    ).toContain("1から3件");
    expect(
      validateSpec(
        javaScriptSpec({
          actions: [emptyAction(), emptyAction(), emptyAction(), emptyAction()],
        }),
        caps(),
        JAVA_VERSIONS["1.21.7"],
      ).join(),
    ).toContain("1から3件");
  });
  it("validates recipe types and version dependent cooking count", () => {
    const cooking = {
      ...shapedRecipe(),
      recipeType: "smelting" as const,
      inputItem: "minecraft:raw_gold",
      resultItem: "minecraft:gold_ingot",
      resultCount: 2,
    };
    const spec = javaSpec({ recipe: cooking });
    expect(
      validateSpec(spec, caps("1.21.7"), JAVA_VERSIONS["1.21.7"]).join(),
    ).toContain("完成数は1固定");
    expect(validateSpec(spec, caps("26.2"), JAVA_VERSIONS["26.2"])).toEqual([]);
    expect(
      validateSpec(
        javaSpec({
          recipe: {
            ...shapedRecipe(),
            recipeType: "smithing_transform",
            smithingTemplate: "minecraft:netherite_upgrade_smithing_template",
            smithingBase: "minecraft:diamond_sword",
            smithingAddition: "minecraft:netherite_ingot",
            resultCount: 2,
          },
        }),
        caps(),
        JAVA_VERSIONS["1.21.7"],
      ).join(),
    ).toContain("1固定");
  });
  it("rejects shaped recipes whose key defines symbols unused in the pattern", () => {
    const withUnusedSymbol = javaSpec({
      recipe: {
        ...shapedRecipe(),
        key: { ...shapedRecipe().key, B: "minecraft:iron_ingot" },
      },
    });
    expect(
      validateSpec(withUnusedSymbol, caps(), JAVA_VERSIONS["1.21.7"]).join(),
    ).toContain("パターンで使われていない記号");
    expect(validateSpec(javaSpec(), caps(), JAVA_VERSIONS["1.21.7"])).toEqual(
      [],
    );
  });
  it("fails closed on unknown Java discriminants", () => {
    const rule = JAVA_VERSIONS["1.21.7"];
    const unknownKind = { ...javaSpec(), kind: "mystery" } as never;
    expect(validateSpec(unknownKind, caps(), rule).join()).toContain(
      "未対応の種類です: mystery",
    );
    const unknownRecipe = javaSpec({
      recipe: { ...shapedRecipe(), recipeType: "brewing" as never },
    });
    expect(validateSpec(unknownRecipe, caps(), rule).join()).toContain(
      "未対応のレシピ種類です: brewing",
    );
    const unknownPattern = javaSpec({
      kind: "resourcepack",
      recipe: undefined,
      resourcepack: {
        pattern: "shader" as never,
        langEntries: [],
        targetItem: "",
        sourceItem: "",
      },
    });
    expect(validateSpec(unknownPattern, caps(), rule).join()).toContain(
      "未対応のリソースパック種別です: shader",
    );
  });
  it("requires a version rule for Java validation", () => {
    const cooking = javaSpec({
      recipe: {
        ...shapedRecipe(),
        recipeType: "smelting",
        inputItem: "minecraft:raw_gold",
        resultItem: "minecraft:gold_ingot",
        resultCount: 2,
      },
    });
    // 26.2 では有効な cooking(count=2) でも、rule 欠落なら設定未取得で拒否する。
    expect(validateSpec(cooking, caps("26.2"), undefined).join()).toContain(
      "設定を取得できていません",
    );
  });
  it("allows setTime/setWeather only on the interval trigger", () => {
    const rule = JAVA_VERSIONS["1.21.7"];
    const onEvent = javaScriptSpec({
      trigger: "consumeItem",
      triggerItemId: "minecraft:apple",
      actions: [emptyAction("setTime")],
    });
    expect(validateSpec(onEvent, caps(), rule).join()).toContain(
      "定期実行トリガーでのみ",
    );
    const onInterval = javaScriptSpec({
      trigger: "interval",
      actions: [emptyAction("setTime")],
    });
    expect(validateSpec(onInterval, caps(), rule)).toEqual([]);
  });
  it("rejects unavailable capabilities and keeps specChecks equivalent", () => {
    const spec = javaSpec({
      kind: "resourcepack",
      recipe: undefined,
      resourcepack: {
        pattern: "itemModelSwap",
        langEntries: [],
        targetItem: "minecraft:diamond_sword",
        sourceItem: "minecraft:netherite_sword",
      },
    });
    expect(
      validateSpec(spec, caps("1.21"), JAVA_VERSIONS["1.21"]).join(),
    ).toContain("未対応の機能");
    for (const candidate of [javaSpec(), javaScriptSpec(), spec]) {
      const errors = validateSpec(candidate, caps(), JAVA_VERSIONS["1.21.7"]);
      expect(
        specChecks(candidate, caps(), JAVA_VERSIONS["1.21.7"]).every(
          (c) => c.ok,
        ),
      ).toBe(errors.length === 0);
    }
  });
});
