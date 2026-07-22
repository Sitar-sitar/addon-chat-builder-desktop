import { describe, expect, it } from "vitest";
import {
  JAVA_CAPABILITIES,
  enabledJavaCapabilities,
  type JavaCapabilityId,
} from "../../src/lib/pattern-catalog";
import { JAVA_GENERATOR_CAPABILITY_COVERAGE } from "../../src/lib/java-generator";
import { JAVA_CAPABILITY_VALIDATORS } from "../../src/lib/spec";
import { JAVA_VERSIONS } from "../../src/lib/pack-rules";
import { generateJavaFiles } from "../../src/lib/java-generator";
import {
  validateSpec,
  type JavaAddonSpec,
  type JavaScriptActionType,
  type JavaScriptTrigger,
} from "../../src/lib/spec";
import {
  emptyAction,
  javaScriptSpec,
  javaSpec,
  shapedRecipe,
} from "./java-fixtures";

describe("pattern catalog", () => {
  it("is complete across prompt, validator, and generator maps", () => {
    const ids = JAVA_CAPABILITIES.map((c) => c.id).sort();
    expect(JAVA_CAPABILITIES.every((c) => c.promptLine.length > 0)).toBe(true);
    expect(Object.keys(JAVA_CAPABILITY_VALIDATORS).sort()).toEqual(ids);
    expect(Object.keys(JAVA_GENERATOR_CAPABILITY_COVERAGE).sort()).toEqual(
      ids,
    );
  });
  it("reproduces the v0.2.0 baseline at release phase 0", () => {
    const baseline = [
      "recipe.shaped",
      "resourcepack.lang",
      "script.action.message",
      "script.trigger.interval",
    ].sort();
    for (const [version, rule] of Object.entries(JAVA_VERSIONS))
      expect(
        enabledJavaCapabilities(rule, 0)
          .map((c) => c.id)
          .sort(),
        version,
      ).toEqual(baseline);
  });
  it("gates every version and release phase deterministically", () => {
    for (const rule of Object.values(JAVA_VERSIONS))
      for (let phase = 0; phase <= 5; phase++) {
        const enabled = enabledJavaCapabilities(rule, phase);
        expect(
          enabled.every(
            (c) =>
              c.phase <= phase &&
              (c.requires ?? []).every((key) => rule[key] === true),
          ),
        ).toBe(true);
      }
    expect(
      enabledJavaCapabilities(JAVA_VERSIONS["1.21"]).some(
        (c) => c.id === "resourcepack.itemModelSwap",
      ),
    ).toBe(false);
    expect(
      enabledJavaCapabilities(JAVA_VERSIONS["1.21.4"]).some(
        (c) => c.id === "resourcepack.itemModelSwap",
      ),
    ).toBe(true);
  });
  it("covers every supported version x capability with generation or a gate rejection", () => {
    for (const [version, rule] of Object.entries(JAVA_VERSIONS)) {
      const enabled = enabledJavaCapabilities(rule).map((c) => c.id);
      for (const capability of JAVA_CAPABILITIES) {
        const spec = specFor(capability.id);
        const errors = validateSpec(spec, enabled, rule);
        if (enabled.includes(capability.id)) {
          expect(errors, `${version} ${capability.id}`).toEqual([]);
          const files = generateJavaFiles(spec, version);
          // 有効 capability は期待するファイル集合ちょうどを生成する（版非依存の path 集合）。
          expect(
            files.map((f) => f.path).sort(),
            `${version} ${capability.id}`,
          ).toEqual([...BASE_PATHS, ...EXPECTED_PATHS[capability.id]].sort());
        } else {
          expect(errors.join("\n"), `${version} ${capability.id}`).toContain(
            "未対応の機能",
          );
          expect(
            () => generateJavaFiles(spec, version),
            `${version} ${capability.id}`,
          ).toThrow("未対応の機能");
        }
      }
    }
  });
});

// specFor の fixture（namespace=test_pack / outputName=test-pack）に対応する
// 期待生成ファイル集合。pack.mcmeta / README.txt は全 capability 共通で加算する。
const BASE_PATHS = ["pack.mcmeta", "README.txt"];
const RECIPE_PATHS = ["data/test_pack/recipe/test-pack.json"];
const SCRIPT_INTERVAL_PATHS = [
  "data/test_pack/function/load.mcfunction",
  "data/test_pack/function/main.mcfunction",
  "data/minecraft/tags/function/load.json",
];
const SCRIPT_ADVANCEMENT_PATHS = [
  "data/test_pack/advancement/on_event.json",
  "data/test_pack/function/on_event.mcfunction",
];
const SCRIPT_SCOREBOARD_PATHS = [
  "data/test_pack/function/load.mcfunction",
  "data/test_pack/function/main.mcfunction",
  "data/test_pack/function/on_event.mcfunction",
  "data/minecraft/tags/function/load.json",
];
const EXPECTED_PATHS: Record<JavaCapabilityId, string[]> = {
  "recipe.shaped": RECIPE_PATHS,
  "recipe.shapeless": RECIPE_PATHS,
  "recipe.cooking": RECIPE_PATHS,
  "recipe.stonecutting": RECIPE_PATHS,
  "recipe.smithing": RECIPE_PATHS,
  "script.trigger.interval": SCRIPT_INTERVAL_PATHS,
  "script.trigger.consumeItem": SCRIPT_ADVANCEMENT_PATHS,
  "script.trigger.placedBlock": SCRIPT_ADVANCEMENT_PATHS,
  "script.trigger.killEntity": SCRIPT_ADVANCEMENT_PATHS,
  "script.trigger.mineBlock": SCRIPT_SCOREBOARD_PATHS,
  "script.trigger.death": SCRIPT_SCOREBOARD_PATHS,
  "script.action.message": SCRIPT_INTERVAL_PATHS,
  "script.action.effect": SCRIPT_INTERVAL_PATHS,
  "script.action.title": SCRIPT_INTERVAL_PATHS,
  "script.action.actionbar": SCRIPT_INTERVAL_PATHS,
  "script.action.playsound": SCRIPT_INTERVAL_PATHS,
  "script.action.setTime": SCRIPT_INTERVAL_PATHS,
  "script.action.setWeather": SCRIPT_INTERVAL_PATHS,
  "loot.blockDrop": ["data/minecraft/loot_table/blocks/stone.json"],
  "resourcepack.lang": [
    "assets/minecraft/lang/ja_jp.json",
    "assets/minecraft/lang/en_us.json",
  ],
  "resourcepack.itemModelSwap": [
    "assets/minecraft/items/diamond_sword.json",
  ],
};

function specFor(id: (typeof JAVA_CAPABILITIES)[number]["id"]): JavaAddonSpec {
  if (id.startsWith("recipe.")) {
    const recipe = { ...shapedRecipe() };
    if (id === "recipe.shapeless")
      Object.assign(recipe, {
        recipeType: "shapeless",
        ingredients: ["minecraft:diamond"],
      });
    if (id === "recipe.cooking")
      Object.assign(recipe, {
        recipeType: "smelting",
        inputItem: "minecraft:raw_gold",
        resultItem: "minecraft:gold_ingot",
      });
    if (id === "recipe.stonecutting")
      Object.assign(recipe, {
        recipeType: "stonecutting",
        inputItem: "minecraft:stone",
      });
    if (id === "recipe.smithing")
      Object.assign(recipe, {
        recipeType: "smithing_transform",
        smithingTemplate: "minecraft:netherite_upgrade_smithing_template",
        smithingBase: "minecraft:diamond_sword",
        smithingAddition: "minecraft:netherite_ingot",
      });
    return javaSpec({ recipe });
  }
  if (id.startsWith("script.trigger.")) {
    const trigger = id.replace("script.trigger.", "") as JavaScriptTrigger;
    return javaScriptSpec({
      trigger,
      triggerItemId: "minecraft:apple",
      triggerEntityId: "minecraft:zombie",
      triggerBlockId: "minecraft:stone",
    });
  }
  if (id.startsWith("script.action.")) {
    const type = id.replace("script.action.", "") as JavaScriptActionType;
    return javaScriptSpec({ actions: [emptyAction(type)] });
  }
  if (id === "loot.blockDrop")
    return javaSpec({
      kind: "loot",
      recipe: undefined,
      loot: {
        targetBlockId: "minecraft:stone",
        dropItemId: "minecraft:gold_ingot",
        dropCount: 1,
      },
    });
  if (id === "resourcepack.itemModelSwap")
    return javaSpec({
      kind: "resourcepack",
      recipe: undefined,
      resourcepack: {
        pattern: "itemModelSwap",
        langEntries: [],
        targetItem: "minecraft:diamond_sword",
        sourceItem: "minecraft:netherite_sword",
      },
    });
  return javaSpec({
    kind: "resourcepack",
    recipe: undefined,
    resourcepack: {
      pattern: "lang",
      langEntries: [{ key: "item.minecraft.apple", value: "りんご" }],
      targetItem: "",
      sourceItem: "",
    },
  });
}
