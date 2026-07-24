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
  it("throws on unknown discriminants in the generator", () => {
    expect(() =>
      generateJavaFiles(
        javaSpec({ recipe: { ...shapedRecipe(), recipeType: "brewing" as never } }),
        "1.21.7",
      ),
    ).toThrow("未対応");
    expect(() =>
      generateJavaFiles({ ...javaSpec(), kind: "mystery" } as never, "1.21.7"),
    ).toThrow("未対応");
    expect(() =>
      generateJavaFiles(
        javaSpec({
          kind: "resourcepack",
          recipe: undefined,
          resourcepack: {
            pattern: "shader" as never,
            langEntries: [],
            targetItem: "",
            sourceItem: "",
          },
        }),
        "1.21.7",
      ),
    ).toThrow("未対応");
  });
  it("writes pack-type specific install instructions in the README", () => {
    const readmeOf = (files: ReturnType<typeof generateJavaFiles>) =>
      files.find((f) => f.path === "README.txt")!.content;
    const datapack = readmeOf(generateJavaFiles(javaSpec(), "1.21.7"));
    expect(datapack).toContain("saves\\<ワールド名>\\datapacks");
    expect(datapack).toContain("/datapack list enabled");
    expect(datapack).not.toContain("resourcepacks");
    const resourcepack = readmeOf(
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
    );
    expect(resourcepack).toContain("resourcepacks");
    expect(resourcepack).toContain("設定 > リソースパック");
    expect(resourcepack).not.toContain("datapacks");
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

  // --- v0.7.3: 時刻/天候アクションの「設定」化 ---

  it("describes time/weather actions as 設定", () => {
    expect(
      describePack(
        javaScriptSpec({ trigger: "interval", actions: [emptyAction("setTime")] }),
        "1.21.7",
      ),
    ).toBe("60秒ごとに、時刻をdayに設定するデータパック（Java 1.21.7）");
    expect(
      describePack(
        javaScriptSpec({
          trigger: "interval",
          actions: [emptyAction("setWeather")],
        }),
        "1.21.7",
      ),
    ).toBe("60秒ごとに、天候をclearに設定するデータパック（Java 1.21.7）");
  });

  it("emits the one-shot command with its harness epilogue on every event trigger", () => {
    const eventCases = [
      {
        fields: { trigger: "consumeItem", triggerItemId: "minecraft:apple" },
        epilogue: "advancement revoke @s only test_pack:on_event",
      },
      {
        fields: { trigger: "placedBlock", triggerBlockId: "minecraft:stone" },
        epilogue: "advancement revoke @s only test_pack:on_event",
      },
      {
        fields: { trigger: "killEntity", triggerEntityId: "minecraft:zombie" },
        epilogue: "advancement revoke @s only test_pack:on_event",
      },
      {
        fields: { trigger: "mineBlock", triggerBlockId: "minecraft:stone" },
        epilogue: "scoreboard players set @s ",
      },
      { fields: { trigger: "death" }, epilogue: "scoreboard players set @s " },
    ] as const;
    const commands = [
      ["setTime", "time set day"],
      ["setWeather", "weather clear"],
    ] as const;
    for (const eventCase of eventCases)
      for (const [action, command] of commands) {
        const files = generateJavaFiles(
          javaScriptSpec({
            ...eventCase.fields,
            actions: [emptyAction(action)],
          }),
          "1.21.7",
        );
        const lines = files
          .find((f) => f.path === "data/test_pack/function/on_event.mcfunction")!
          .content.trim()
          .split("\n");
        expect(lines[0]).toBe(command);
        expect(lines[lines.length - 1].startsWith(eventCase.epilogue)).toBe(true);
      }
  });

  it("adds the one-shot note for time/weather and the dimension note only for setTime", () => {
    const readme = (actions: ReturnType<typeof emptyAction>[]) =>
      generateJavaFiles(
        javaScriptSpec({ trigger: "interval", actions }),
        "1.21.7",
      ).find((f) => f.path === "README.txt")!.content;
    const oneShot = "注意: 時刻・天候は発火時に1回だけ設定されます";
    const dimension = "注意: 時刻の設定はオーバーワールドでの実行を前提とします";

    const timeOnly = readme([emptyAction("setTime")]);
    expect(timeOnly).toContain(oneShot);
    expect(timeOnly).toContain(dimension);

    const weatherOnly = readme([emptyAction("setWeather")]);
    expect(weatherOnly).toContain(oneShot);
    expect(weatherOnly).not.toContain(dimension);

    const neither = readme([emptyAction("message")]);
    expect(neither).not.toContain(oneShot);
    expect(neither).not.toContain(dimension);
  });

  // REV-P1-01: 許容差分は pack.mcmeta の description と README.txt のみ。
  // それ以外は v0.7.2 とバイト一致でなければならない。
  it("limits the v0.7.2 diff to pack.mcmeta description and README.txt", () => {
    const files = generateJavaFiles(
      javaScriptSpec({ trigger: "interval", actions: [emptyAction("setTime")] }),
      "1.21.7",
    );
    const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));
    expect(Object.keys(byPath).sort()).toEqual([
      "README.txt",
      "data/minecraft/tags/function/load.json",
      "data/test_pack/function/load.mcfunction",
      "data/test_pack/function/main.mcfunction",
      "pack.mcmeta",
    ]);

    // バイト一致（v0.7.2 と同一）
    expect(byPath["data/test_pack/function/load.mcfunction"]).toBe(
      "schedule function test_pack:main 60s replace\n",
    );
    expect(byPath["data/test_pack/function/main.mcfunction"]).toBe(
      "time set day\nschedule function test_pack:main 60s replace\n",
    );
    expect(JSON.parse(byPath["data/minecraft/tags/function/load.json"])).toEqual(
      { values: ["test_pack:load"] },
    );

    // 許容差分1: pack.mcmeta は description のみ。format 系キーは不変。
    const mcmeta = JSON.parse(byPath["pack.mcmeta"]);
    expect(Object.keys(mcmeta.pack).sort()).toEqual([
      "description",
      "pack_format",
    ]);
    expect(mcmeta.pack.pack_format).toBe(81);
    expect(mcmeta.pack.description).toBe(
      "60秒ごとに、時刻をdayに設定するデータパック（Java 1.21.7）",
    );

    // 許容差分2: README は description 行と注記のみ。
    expect(byPath["README.txt"]).toContain(
      "60秒ごとに、時刻をdayに設定するデータパック（Java 1.21.7）",
    );
    expect(byPath["README.txt"]).not.toContain("固定する");
  });
});
