import { describe, expect, it } from "vitest";
import {
  describePack,
  generateJavaFiles,
  JAVA_GENERATOR_CAPABILITY_COVERAGE,
} from "../../src/lib/java-generator";
import { JAVA_CAPABILITIES } from "../../src/lib/pattern-catalog";
import {
  emptyAction,
  javaScriptSpec,
  javaSpec,
  shapedRecipe,
} from "./java-fixtures";

const parse = (files: ReturnType<typeof generateJavaFiles>, path: string) =>
  JSON.parse(files.find((f) => f.path === path)!.content);

describe("java generator", () => {
  it("has a coverage entry for every catalog capability id", () =>
    expect(Object.keys(JAVA_GENERATOR_CAPABILITY_COVERAGE).sort()).toEqual(
      JAVA_CAPABILITIES.map((c) => c.id).sort(),
    ));
  it("keeps shaped recipe file stable and derives one description for mcmeta/readme", () => {
    const spec = javaSpec();
    const files = generateJavaFiles(spec, "1.21.5");
    const description = describePack(spec, "1.21.5");
    expect(parse(files, "data/test_pack/recipe/test-pack.json")).toEqual({
      type: "minecraft:crafting_shaped",
      pattern: [" # ", " # ", " S "],
      key: { "#": "minecraft:diamond", S: "minecraft:stick" },
      result: { id: "minecraft:diamond_sword", count: 1 },
    });
    expect(parse(files, "pack.mcmeta").pack).toEqual({
      pack_format: 71,
      description,
    });
    expect(files.find((f) => f.path === "README.txt")!.content).toContain(
      description,
    );
  });
  it("generates 26.2 min/max metadata and clock-aware predicates", () => {
    const spec = javaScriptSpec({
      condition: "night",
      actions: [{ ...emptyAction("effect"), effectSeconds: 75 }],
    });
    const files = generateJavaFiles(spec, "26.2");
    expect(parse(files, "pack.mcmeta").pack).toMatchObject({
      min_format: [107, 1],
      max_format: [107, 1],
    });
    expect(parse(files, "data/test_pack/predicate/night.json")).toEqual({
      condition: "minecraft:time_check",
      clock: "minecraft:overworld",
      period: 24000,
      value: { min: 12542, max: 23459 },
    });
    expect(
      files.find((f) => f.path.endsWith("main.mcfunction"))!.content,
    ).toContain(
      "execute if predicate test_pack:night run execute as @a run effect give @s minecraft:night_vision 75 0 true\nschedule function test_pack:main 60s replace\n",
    );
  });
  it.each(["1.21", "1.21.4", "1.21.5", "1.21.7"])(
    "omits clock in %s day/night predicates",
    (version) => {
      for (const condition of ["day", "night"] as const) {
        const predicate = parse(
          generateJavaFiles(javaScriptSpec({ condition }), version),
          `data/test_pack/predicate/${condition}.json`,
        );
        expect(JSON.stringify(predicate)).not.toContain("clock");
      }
    },
  );
  it("generates advancement events with unconditional revoke", () => {
    const spec = javaScriptSpec({
      trigger: "consumeItem",
      triggerItemId: "minecraft:apple",
      condition: "day",
      actions: [{ ...emptyAction("effect"), effectSeconds: 5 }],
    });
    const files = generateJavaFiles(spec, "1.21.7");
    expect(parse(files, "data/test_pack/advancement/on_event.json")).toEqual({
      criteria: {
        trigger: {
          trigger: "minecraft:consume_item",
          conditions: { item: { items: ["minecraft:apple"] } },
        },
      },
      rewards: { function: "test_pack:on_event" },
    });
    expect(
      files
        .find((f) => f.path.endsWith("on_event.mcfunction"))!
        .content.split("\n")
        .slice(-2, -1)[0],
    ).toBe("advancement revoke @s only test_pack:on_event");
  });
  it("generates scoreboard event reset after guarded actions", () => {
    const files = generateJavaFiles(
      javaScriptSpec({
        trigger: "mineBlock",
        triggerBlockId: "minecraft:stone",
        condition: "night",
      }),
      "1.21.7",
    );
    expect(
      files.find((f) => f.path.endsWith("load.mcfunction"))!.content,
    ).toMatch(
      /scoreboard objectives add acb_[a-f0-9]{11} minecraft\.mined:minecraft\.stone/,
    );
    expect(
      files.find((f) => f.path.endsWith("on_event.mcfunction"))!.content,
    ).toMatch(/scoreboard players set @s acb_[a-f0-9]{11} 0\n$/);
  });
  it("generates all recipe, loot, and item model templates", () => {
    const shapeless = generateJavaFiles(
      javaSpec({
        recipe: {
          ...shapedRecipe(),
          recipeType: "shapeless",
          ingredients: ["minecraft:diamond", "minecraft:stick"],
        },
      }),
      "1.21.7",
    );
    expect(parse(shapeless, "data/test_pack/recipe/test-pack.json").type).toBe(
      "minecraft:crafting_shapeless",
    );
    const cooking = generateJavaFiles(
      javaSpec({
        recipe: {
          ...shapedRecipe(),
          recipeType: "smelting",
          inputItem: "minecraft:raw_gold",
          resultItem: "minecraft:gold_ingot",
          resultCount: 2,
        },
      }),
      "26.2",
    );
    expect(
      parse(cooking, "data/test_pack/recipe/test-pack.json").result.count,
    ).toBe(2);
    const loot = generateJavaFiles(
      javaSpec({
        kind: "loot",
        recipe: undefined,
        loot: {
          targetBlockId: "minecraft:stone",
          dropItemId: "minecraft:gold_ingot",
          dropCount: 2,
        },
      }),
      "1.21.7",
    );
    expect(
      parse(loot, "data/minecraft/loot_table/blocks/stone.json").pools[0].rolls,
    ).toBe(2);
    const model = generateJavaFiles(
      javaSpec({
        kind: "resourcepack",
        recipe: undefined,
        resourcepack: {
          pattern: "itemModelSwap",
          langEntries: [],
          targetItem: "minecraft:diamond_sword",
          sourceItem: "minecraft:netherite_sword",
        },
      }),
      "1.21.4",
    );
    expect(parse(model, "assets/minecraft/items/diamond_sword.json")).toEqual({
      model: {
        type: "minecraft:model",
        model: "minecraft:item/netherite_sword",
      },
    });
  });
  it("adds the namespace collision note only to script README files", () => {
    const readmeOf = (files: ReturnType<typeof generateJavaFiles>) =>
      files.find((f) => f.path === "README.txt")!.content;

    expect(readmeOf(generateJavaFiles(javaScriptSpec(), "1.21.7"))).toContain(
      "同じ namespace（test_pack）",
    );
    expect(readmeOf(generateJavaFiles(javaSpec(), "1.21.7"))).not.toContain(
      "同じ namespace",
    );
    expect(
      readmeOf(
        generateJavaFiles(
          javaSpec({
            kind: "loot",
            recipe: undefined,
            loot: {
              targetBlockId: "minecraft:stone",
              dropItemId: "minecraft:gold_ingot",
              dropCount: 1,
            },
          }),
          "1.21.7",
        ),
      ),
    ).not.toContain("同じ namespace");
    expect(
      readmeOf(
        generateJavaFiles(
          javaSpec({
            kind: "resourcepack",
            recipe: undefined,
            resourcepack: {
              pattern: "lang",
              langEntries: [{ key: "item.minecraft.apple", value: "りんご" }],
              targetItem: "",
              sourceItem: "",
            },
          }),
          "1.21.7",
        ),
      ),
    ).not.toContain("同じ namespace");
  });
});
