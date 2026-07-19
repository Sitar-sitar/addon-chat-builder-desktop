import {
  capabilitiesForSpec,
  enabledJavaCapabilities,
  type JavaCapabilityId,
} from "./pattern-catalog";
import {
  resolveJavaVersion,
  resolvePackType,
  type GeneratedPackFile,
  type JavaVersionRule,
  type PackFormat,
} from "./pack-rules";
import {
  objectiveName,
  type JavaAddonSpec,
  type JavaScriptAction,
  type JavaScriptSpec,
} from "./spec";

export const JAVA_GENERATOR_HANDLERS: Record<JavaCapabilityId, true> = {
  "recipe.shaped": true,
  "recipe.shapeless": true,
  "recipe.cooking": true,
  "recipe.stonecutting": true,
  "recipe.smithing": true,
  "script.trigger.interval": true,
  "script.trigger.consumeItem": true,
  "script.trigger.placedBlock": true,
  "script.trigger.killEntity": true,
  "script.trigger.mineBlock": true,
  "script.trigger.death": true,
  "script.action.message": true,
  "script.action.effect": true,
  "script.action.title": true,
  "script.action.actionbar": true,
  "script.action.playsound": true,
  "script.action.setTime": true,
  "script.action.setWeather": true,
  "loot.blockDrop": true,
  "resourcepack.lang": true,
  "resourcepack.itemModelSwap": true,
};

export function generateJavaFiles(
  spec: JavaAddonSpec,
  versionInput?: string,
): GeneratedPackFile[] {
  const { version, rule } = resolveJavaVersion(versionInput);
  const enabled = new Set(enabledJavaCapabilities(rule).map((c) => c.id));
  for (const capability of capabilitiesForSpec(spec)) {
    if (!enabled.has(capability))
      throw new Error(`現在のJava版では未対応の機能です: ${capability}`);
    JAVA_GENERATOR_HANDLERS[capability];
  }
  const description = describePack(spec, version);
  const packType = resolvePackType(spec);
  const format =
    packType === "resourcepack" ? rule.resourcepackFormat : rule.datapackFormat;
  const files: GeneratedPackFile[] = [
    packMcmeta(format, rule, description),
    { path: "README.txt", content: buildReadme(spec, version, description) },
  ];
  if (spec.kind === "recipe") files.push(generateRecipe(spec, rule));
  else if (spec.kind === "script") files.push(...generateScript(spec, rule));
  else if (spec.kind === "loot") files.push(generateLoot(spec));
  else files.push(...generateResourcepack(spec));
  assertUniquePaths(files);
  return files;
}

export function describePack(spec: JavaAddonSpec, version: string): string {
  if (spec.kind === "script" && spec.javaScript) {
    const s = spec.javaScript;
    const condition =
      s.condition === "always"
        ? ""
        : `${{ day: "昼", night: "夜", rain: "雨", thunder: "雷雨" }[s.condition]}の間だけ`;
    const trigger =
      s.trigger === "interval"
        ? `${s.intervalSeconds}秒ごとに`
        : s.trigger === "consumeItem"
          ? `${displayId(s.triggerItemId)}を食べたときに`
          : s.trigger === "placedBlock"
            ? `${displayId(s.triggerBlockId)}を設置したときに`
            : s.trigger === "killEntity"
              ? `${displayId(s.triggerEntityId)}を倒したときに`
              : s.trigger === "mineBlock"
                ? `${displayId(s.triggerBlockId)}を掘ったときに`
                : "死亡したときに";
    return `${condition}${trigger}、${s.actions.map(describeAction).join("・")}するデータパック（Java ${version}）`;
  }
  if (spec.kind === "recipe" && spec.recipe) {
    const equipment: Record<string, string> = {
      shaped: "作業台",
      shapeless: "作業台",
      smelting: "かまど",
      blasting: "溶鉱炉",
      smoking: "燻製器",
      campfire_cooking: "焚き火",
      stonecutting: "石切台",
      smithing_transform: "鍛冶台",
    };
    return `${equipment[spec.recipe.recipeType]}で${displayId(spec.recipe.resultItem)}×${spec.recipe.resultCount}を作るレシピ（Java ${version}）`;
  }
  if (spec.kind === "loot" && spec.loot)
    return `${displayId(spec.loot.targetBlockId)}のドロップを${displayId(spec.loot.dropItemId)}×${spec.loot.dropCount}へ差し替えるデータパック（Java ${version}）`;
  if (spec.resourcepack?.pattern === "itemModelSwap")
    return `${displayId(spec.resourcepack.targetItem)}の見た目を${displayId(spec.resourcepack.sourceItem)}へ差し替えるリソースパック（Java ${version}）`;
  return `表示名を${spec.resourcepack?.langEntries.length ?? 0}件変更するリソースパック（Java ${version}）`;
}

function describeAction(a: JavaScriptAction): string {
  if (a.type === "message") return "チャット通知";
  if (a.type === "effect")
    return `${displayId(a.effectId)}付与（強さ${a.effectAmplifier + 1}・${a.effectSeconds}秒）`;
  if (a.type === "title") return "タイトル表示";
  if (a.type === "actionbar") return "アクションバー表示";
  if (a.type === "playsound") return "サウンド再生";
  if (a.type === "setTime") return `時刻を${a.timeValue}に固定`;
  return `天候を${a.weatherValue}に固定`;
}

function displayId(id: string): string {
  const v = id.replace(/^minecraft:/, "");
  return v.length > 30 ? `${v.slice(0, 30)}…` : v;
}

function packMcmeta(
  format: PackFormat,
  rule: JavaVersionRule,
  description: string,
): GeneratedPackFile {
  return rule.mcmetaFormat === "legacy"
    ? jsonFile("pack.mcmeta", { pack: { pack_format: format, description } })
    : jsonFile("pack.mcmeta", {
        pack: { description, min_format: format, max_format: format },
      });
}

function ingredient(id: string, plain: boolean): string | { item: string } {
  return plain ? id : { item: id };
}

function generateRecipe(
  spec: JavaAddonSpec,
  rule: JavaVersionRule,
): GeneratedPackFile {
  const r = spec.recipe!;
  let value: unknown;
  if (r.recipeType === "shaped")
    value = {
      type: "minecraft:crafting_shaped",
      pattern: r.pattern,
      key: Object.fromEntries(
        Object.entries(r.key).map(([k, v]) => [
          k,
          ingredient(v, rule.plainIngredients),
        ]),
      ),
      result: { id: r.resultItem, count: r.resultCount },
    };
  else if (r.recipeType === "shapeless")
    value = {
      type: "minecraft:crafting_shapeless",
      ingredients: r.ingredients.map((id) =>
        ingredient(id, rule.plainIngredients),
      ),
      result: { id: r.resultItem, count: r.resultCount },
    };
  else if (
    ["smelting", "blasting", "smoking", "campfire_cooking"].includes(
      r.recipeType,
    )
  )
    value = {
      type: `minecraft:${r.recipeType}`,
      ingredient: ingredient(r.inputItem, rule.plainIngredients),
      result: {
        id: r.resultItem,
        ...(rule.cookingResultCount ? { count: r.resultCount } : {}),
      },
      experience: r.cookingXp,
      cookingtime: r.cookingSeconds * 20,
    };
  else if (r.recipeType === "stonecutting")
    value = {
      type: "minecraft:stonecutting",
      ingredient: ingredient(r.inputItem, rule.plainIngredients),
      result: { id: r.resultItem, count: r.resultCount },
    };
  else
    value = {
      type: "minecraft:smithing_transform",
      template: ingredient(r.smithingTemplate, rule.plainIngredients),
      base: ingredient(r.smithingBase, rule.plainIngredients),
      addition: ingredient(r.smithingAddition, rule.plainIngredients),
      result: { id: r.resultItem },
    };
  return jsonFile(
    `data/${spec.namespace}/recipe/${spec.outputName}.json`,
    value,
  );
}

type TriggerHarness = {
  files: GeneratedPackFile[];
  actionInsertFile: string;
  actionColumn: "interval" | "event";
  epilogue: string[];
};
function generateScript(
  spec: JavaAddonSpec,
  rule: JavaVersionRule,
): GeneratedPackFile[] {
  const script = spec.javaScript!;
  const harness = triggerHarness(spec, script);
  const prefix =
    script.condition === "always"
      ? ""
      : `execute if predicate ${spec.namespace}:${script.condition} run `;
  const actions = script.actions.map(
    (a) => prefix + actionFragment(a, harness.actionColumn),
  );
  const target = harness.files.find((f) => f.path === harness.actionInsertFile);
  if (!target) throw new Error("アクション挿入先がありません。");
  target.content = [...actions, ...harness.epilogue].join("\n") + "\n";
  if (script.condition !== "always")
    harness.files.push(
      generatePredicate(spec.namespace, script.condition, rule),
    );
  return harness.files;
}

function triggerHarness(
  spec: JavaAddonSpec,
  s: JavaScriptSpec,
): TriggerHarness {
  const loadPath = `data/${spec.namespace}/function/load.mcfunction`,
    mainPath = `data/${spec.namespace}/function/main.mcfunction`,
    eventPath = `data/${spec.namespace}/function/on_event.mcfunction`;
  const loadTag = jsonFile("data/minecraft/tags/function/load.json", {
    values: [`${spec.namespace}:load`],
  });
  if (s.trigger === "interval") {
    const schedule = `schedule function ${spec.namespace}:main ${s.intervalSeconds}s replace`;
    return {
      files: [
        { path: loadPath, content: schedule + "\n" },
        { path: mainPath, content: "" },
        loadTag,
      ],
      actionInsertFile: mainPath,
      actionColumn: "interval",
      epilogue: [schedule],
    };
  }
  if (["consumeItem", "placedBlock", "killEntity"].includes(s.trigger)) {
    const criteria =
      s.trigger === "consumeItem"
        ? {
            trigger: "minecraft:consume_item",
            conditions: { item: { items: [s.triggerItemId] } },
          }
        : s.trigger === "placedBlock"
          ? {
              trigger: "minecraft:placed_block",
              conditions: {
                location: [
                  {
                    condition: "minecraft:location_check",
                    predicate: { block: { blocks: [s.triggerBlockId] } },
                  },
                ],
              },
            }
          : {
              trigger: "minecraft:player_killed_entity",
              conditions: {
                entity: [
                  {
                    condition: "minecraft:entity_properties",
                    entity: "this",
                    predicate: { type: s.triggerEntityId },
                  },
                ],
              },
            };
    return {
      files: [
        jsonFile(`data/${spec.namespace}/advancement/on_event.json`, {
          criteria: { trigger: criteria },
          rewards: { function: `${spec.namespace}:on_event` },
        }),
        { path: eventPath, content: "" },
      ],
      actionInsertFile: eventPath,
      actionColumn: "event",
      epilogue: [`advancement revoke @s only ${spec.namespace}:on_event`],
    };
  }
  const objective = objectiveName(spec.namespace, s.trigger, s.triggerBlockId);
  const criteria =
    s.trigger === "mineBlock"
      ? `minecraft.mined:minecraft.${s.triggerBlockId.replace("minecraft:", "")}`
      : "deathCount";
  const load = `scoreboard objectives add ${objective} ${criteria}\nschedule function ${spec.namespace}:main 1s replace\n`;
  const main = `execute as @a if score @s ${objective} matches 1.. run function ${spec.namespace}:on_event\nschedule function ${spec.namespace}:main 1s replace\n`;
  return {
    files: [
      { path: loadPath, content: load },
      { path: mainPath, content: main },
      { path: eventPath, content: "" },
      loadTag,
    ],
    actionInsertFile: eventPath,
    actionColumn: "event",
    epilogue: [`scoreboard players set @s ${objective} 0`],
  };
}

function actionFragment(
  a: JavaScriptAction,
  column: "interval" | "event",
): string {
  const all = column === "interval",
    target = all ? "@a" : "@s";
  if (a.type === "message")
    return `tellraw ${target} ${JSON.stringify({ text: a.text })}`;
  if (a.type === "effect")
    return all
      ? `execute as @a run effect give @s ${a.effectId} ${a.effectSeconds} ${a.effectAmplifier} true`
      : `effect give @s ${a.effectId} ${a.effectSeconds} ${a.effectAmplifier} true`;
  if (a.type === "title")
    return `title ${target} title ${JSON.stringify({ text: a.text })}`;
  if (a.type === "actionbar")
    return `title ${target} actionbar ${JSON.stringify({ text: a.text })}`;
  if (a.type === "playsound")
    return all
      ? `execute as @a at @s run playsound ${a.soundId} master @s ~ ~ ~ 1 1`
      : `execute at @s run playsound ${a.soundId} master @s ~ ~ ~ 1 1`;
  if (a.type === "setTime") return `time set ${a.timeValue}`;
  return `weather ${a.weatherValue}`;
}

function generatePredicate(
  namespace: string,
  condition: JavaScriptSpec["condition"],
  rule: JavaVersionRule,
): GeneratedPackFile {
  const clock = rule.timeCheckClock ? { clock: "minecraft:overworld" } : {};
  const check = (min: number, max: number) => ({
    condition: "minecraft:time_check",
    ...clock,
    period: 24000,
    value: { min, max },
  });
  const value =
    condition === "night"
      ? check(12542, 23459)
      : condition === "day"
        ? {
            condition: "minecraft:any_of",
            terms: [check(0, 12541), check(23460, 23999)],
          }
        : condition === "rain"
          ? { condition: "minecraft:weather_check", raining: true }
          : { condition: "minecraft:weather_check", thundering: true };
  return jsonFile(`data/${namespace}/predicate/${condition}.json`, value);
}

function generateLoot(spec: JavaAddonSpec): GeneratedPackFile {
  const l = spec.loot!;
  return jsonFile(
    `data/minecraft/loot_table/blocks/${l.targetBlockId.replace("minecraft:", "")}.json`,
    {
      type: "minecraft:block",
      pools: [
        {
          rolls: l.dropCount,
          entries: [{ type: "minecraft:item", name: l.dropItemId }],
          conditions: [{ condition: "minecraft:survives_explosion" }],
        },
      ],
    },
  );
}
function generateResourcepack(spec: JavaAddonSpec): GeneratedPackFile[] {
  const r = spec.resourcepack!;
  if (r.pattern === "itemModelSwap")
    return [
      jsonFile(
        `assets/minecraft/items/${r.targetItem.replace("minecraft:", "")}.json`,
        {
          model: {
            type: "minecraft:model",
            model: `minecraft:item/${r.sourceItem.replace("minecraft:", "")}`,
          },
        },
      ),
    ];
  const entries = Object.fromEntries(
    r.langEntries.map((e) => [e.key, e.value.trim()]),
  );
  return [
    jsonFile("assets/minecraft/lang/ja_jp.json", entries),
    jsonFile("assets/minecraft/lang/en_us.json", entries),
  ];
}
function jsonFile(path: string, value: unknown): GeneratedPackFile {
  return { path, content: `${JSON.stringify(value, null, 2)}\n` };
}
function assertUniquePaths(files: GeneratedPackFile[]): void {
  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f.path))
      throw new Error(`生成ファイルのパスが重複しています: ${f.path}`);
    seen.add(f.path);
  }
}
function buildReadme(
  spec: JavaAddonSpec,
  version: string,
  description: string,
): string {
  const destination =
    resolvePackType(spec) === "resourcepack" ? "resourcepacks" : "datapacks";
  const notes = [
    "注意: minecraft: IDの実在確認は行いません。存在しないIDを指定した処理はゲーム内で無効になります。",
  ];
  if (spec.kind === "loot")
    notes.push(
      "注意: ブロックドロップを完全上書きするため、シルクタッチ・幸運の元挙動は失われます。",
    );
  if (
    spec.kind === "script" &&
    ["mineBlock", "death"].includes(spec.javaScript?.trigger ?? "")
  )
    notes.push("注意: イベント検知には最大1秒の遅延があります。");
  return [
    spec.title,
    "",
    description,
    "",
    `対象: Minecraft Java Edition ${version}`,
    `導入: このzipを対象ワールドまたはMinecraftの ${destination} フォルダへ配置してください。`,
    ...notes,
    "",
  ].join("\n");
}
