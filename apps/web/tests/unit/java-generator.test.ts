import { describe, expect, it } from "vitest";
import { generateJavaFiles } from "@/lib/java-generator";
import { AddonSpec } from "@/lib/spec";

const recipe: AddonSpec = {
  edition: "java",
  title: "棒レシピ",
  description: "ダイヤから棒を作る",
  kind: "recipe",
  namespace: "sample",
  outputName: "diamond-stick",
  recipe: { resultItem: "minecraft:stick", resultCount: 2, pattern: ["#"], key: { "#": "minecraft:diamond" } },
  unresolvedQuestions: []
};

it("1.21と1.21.5のレシピ形式・pack_formatを完全一致で生成する", () => {
  const oldFiles = generateJavaFiles(recipe, "1.21");
  const currentFiles = generateJavaFiles(recipe, "1.21.5");
  expect(oldFiles[0].content).toBe('{\n  "pack": {\n    "pack_format": 48,\n    "description": "ダイヤから棒を作る"\n  }\n}\n');
  expect(JSON.parse(oldFiles[2].content).key["#"]).toEqual({ item: "minecraft:diamond" });
  expect(currentFiles[0].content).toBe('{\n  "pack": {\n    "pack_format": 71,\n    "description": "ダイヤから棒を作る"\n  }\n}\n');
  expect(JSON.parse(currentFiles[2].content).key["#"]).toBe("minecraft:diamond");
  expect(currentFiles.map((file) => file.path)).toEqual([
    "pack.mcmeta",
    "README.txt",
    "data/sample/recipe/diamond-stick.json"
  ]);
});

describe("interval script", () => {
  it("tellrawをJSONエスケープしscheduleで自己再予約する", () => {
    const spec: AddonSpec = {
      ...recipe,
      title: "通知",
      description: "定期通知",
      kind: "script",
      outputName: "notify",
      script: { event: "interval", summary: "通知", message: '休憩 "しよう"\n次の行', intervalSeconds: 60 },
      recipe: undefined
    };
    const files = generateJavaFiles(spec, "1.21.5");
    expect(files.map((file) => file.path)).toEqual([
      "pack.mcmeta",
      "README.txt",
      "data/sample/function/load.mcfunction",
      "data/sample/function/main.mcfunction",
      "data/minecraft/tags/function/load.json"
    ]);
    expect(files[2].content).toBe("schedule function sample:main 60s replace\n");
    expect(files[3].content).toBe('tellraw @a {"text":"休憩 \\"しよう\\"\\n次の行"}\nschedule function sample:main 60s replace\n');
    expect(files[4].content).toBe('{\n  "values": [\n    "sample:load"\n  ]\n}\n');
  });
});

it("resourcepackのja_jpとen_usへ同一entryを生成する", () => {
  const spec: AddonSpec = {
    ...recipe,
    title: "名前変更",
    description: "表示名変更",
    kind: "resourcepack",
    outputName: "names",
    recipe: undefined,
    resourcepack: {
      langEntries: [
        { key: "item.minecraft.diamond_sword", value: "伝説の剣" },
        { key: "block.minecraft.stone", value: "特別な石" }
      ]
    }
  };
  const files = generateJavaFiles(spec, "1.21.5");
  expect(JSON.parse(files[0].content).pack.pack_format).toBe(55);
  expect(files[2].path).toBe("assets/minecraft/lang/ja_jp.json");
  expect(files[3].path).toBe("assets/minecraft/lang/en_us.json");
  expect(files[2].content).toBe(files[3].content);
  expect(files[2].content).toBe('{\n  "item.minecraft.diamond_sword": "伝説の剣",\n  "block.minecraft.stone": "特別な石"\n}\n');
});
