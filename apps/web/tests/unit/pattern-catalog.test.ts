import { describe, expect, it } from "vitest";
import {
  JAVA_CAPABILITIES,
  enabledJavaCapabilities,
} from "../../src/lib/pattern-catalog";
import { JAVA_GENERATOR_HANDLERS } from "../../src/lib/java-generator";
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
    expect(Object.keys(JAVA_GENERATOR_HANDLERS).sort()).toEqual(ids);
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
          expect(
            () => generateJavaFiles(spec, version),
            `${version} ${capability.id}`,
          ).not.toThrow();
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
