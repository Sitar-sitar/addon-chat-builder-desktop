import { resolveJavaVersion, resolvePackType } from "./pack-rules";
import type { GeneratedPackFile } from "./pack-rules";
import type { AddonSpec } from "./spec";

export function generateJavaFiles(spec: AddonSpec, versionInput?: string): GeneratedPackFile[] {
  if (spec.edition !== "java") {
    throw new Error("Java生成器には Java版の仕様を渡してください。");
  }

  const { version, rule } = resolveJavaVersion(versionInput);
  const packType = resolvePackType(spec);
  const packFormat = packType === "resourcepack" ? rule.resourcepackFormat : rule.datapackFormat;
  const files: GeneratedPackFile[] = [
    jsonFile("pack.mcmeta", {
      pack: {
        pack_format: packFormat,
        description: spec.description
      }
    }),
    {
      path: "README.txt",
      content: buildReadme(spec, version)
    }
  ];

  if (spec.kind === "recipe") {
    files.push(generateRecipe(spec, rule.plainIngredients));
  } else if (spec.kind === "script") {
    files.push(...generateIntervalScript(spec));
  } else if (spec.kind === "resourcepack") {
    files.push(...generateResourcepack(spec));
  } else {
    throw new Error(`Java版では ${spec.kind} を生成できません。`);
  }

  return files;
}

function generateRecipe(spec: AddonSpec, plainIngredients: boolean): GeneratedPackFile {
  if (!spec.recipe) throw new Error("レシピ情報が未設定です。");
  const key = Object.fromEntries(
    Object.entries(spec.recipe.key).map(([symbol, item]) => [symbol, plainIngredients ? item : { item }])
  );
  return jsonFile(`data/${spec.namespace}/recipe/${spec.outputName}.json`, {
    type: "minecraft:crafting_shaped",
    pattern: spec.recipe.pattern,
    key,
    result: {
      id: spec.recipe.resultItem,
      count: spec.recipe.resultCount
    }
  });
}

function generateIntervalScript(spec: AddonSpec): GeneratedPackFile[] {
  if (!spec.script?.intervalSeconds) throw new Error("通知間隔が未設定です。");
  const schedule = `schedule function ${spec.namespace}:main ${spec.script.intervalSeconds}s replace`;
  const tellraw = `tellraw @a ${JSON.stringify({ text: spec.script.message })}`;
  return [
    { path: `data/${spec.namespace}/function/load.mcfunction`, content: `${schedule}\n` },
    { path: `data/${spec.namespace}/function/main.mcfunction`, content: `${tellraw}\n${schedule}\n` },
    jsonFile("data/minecraft/tags/function/load.json", { values: [`${spec.namespace}:load`] })
  ];
}

function generateResourcepack(spec: AddonSpec): GeneratedPackFile[] {
  const entries = Object.fromEntries(
    (spec.resourcepack?.langEntries ?? []).map((entry) => [entry.key, entry.value.trim()])
  );
  return [
    jsonFile("assets/minecraft/lang/ja_jp.json", entries),
    jsonFile("assets/minecraft/lang/en_us.json", entries)
  ];
}

function jsonFile(path: string, value: unknown): GeneratedPackFile {
  return { path, content: `${JSON.stringify(value, null, 2)}\n` };
}

function buildReadme(spec: AddonSpec, version: string): string {
  const packType = resolvePackType(spec);
  const destination = packType === "resourcepack" ? "resourcepacks" : "datapacks";
  const notes = spec.kind === "recipe"
    ? "注意: minecraft: IDの実在確認は行いません。存在しないIDを指定したレシピはゲーム内で無効になります。\n"
    : "";
  return [
    spec.title,
    "",
    `対象: Minecraft Java Edition ${version}`,
    `導入: このzipを対象ワールドまたはMinecraftの ${destination} フォルダへ配置してください。`,
    notes.trimEnd(),
    ""
  ].filter((line, index, lines) => line || index === 1 || index === lines.length - 1).join("\n");
}
