import type { JavaCapabilityId } from "./pattern-catalog";
import type { JavaVersionRule } from "./pack-rules";

export type Edition = "bedrock" | "java";
export type AddonKind = "recipe" | "item" | "script" | "resourcepack" | "loot";

export type BedrockAddonSpec = {
  edition: "bedrock";
  title: string;
  description: string;
  kind: "recipe" | "item" | "script";
  namespace: string;
  outputName: string;
  recipe?: {
    resultItem: string;
    resultCount: number;
    pattern: string[];
    key: Record<string, string>;
  };
  item?: { identifier: string; displayName: string; maxStackSize: number };
  script?: {
    event: "itemUse" | "blockBreak" | "interval";
    summary: string;
    message: string;
    intervalSeconds?: number;
  };
  unresolvedQuestions: string[];
};

export type ScriptCondition = "always" | "day" | "night" | "rain" | "thunder";
export type JavaScriptTrigger =
  | "interval"
  | "consumeItem"
  | "placedBlock"
  | "killEntity"
  | "mineBlock"
  | "death";
export type JavaScriptActionType =
  | "message"
  | "effect"
  | "title"
  | "actionbar"
  | "playsound"
  | "setTime"
  | "setWeather";
export type JavaScriptAction = {
  type: JavaScriptActionType;
  text: string;
  effectId: string;
  effectSeconds: number;
  effectAmplifier: number;
  soundId: string;
  timeValue: "day" | "night" | "noon" | "midnight" | "";
  weatherValue: "clear" | "rain" | "thunder" | "";
};
export type JavaScriptSpec = {
  trigger: JavaScriptTrigger;
  intervalSeconds: number;
  condition: ScriptCondition;
  actions: JavaScriptAction[];
  triggerItemId: string;
  triggerEntityId: string;
  triggerBlockId: string;
  summary: string;
};
export type JavaRecipeSpec = {
  recipeType:
    | "shaped"
    | "shapeless"
    | "smelting"
    | "blasting"
    | "smoking"
    | "campfire_cooking"
    | "stonecutting"
    | "smithing_transform";
  resultItem: string;
  resultCount: number;
  pattern: string[];
  key: Record<string, string>;
  ingredients: string[];
  inputItem: string;
  cookingXp: number;
  cookingSeconds: number;
  smithingTemplate: string;
  smithingBase: string;
  smithingAddition: string;
};
export type LootSpec = {
  targetBlockId: string;
  dropItemId: string;
  dropCount: number;
};
export type ResourcepackSpec = {
  pattern: "lang" | "itemModelSwap";
  langEntries: { key: string; value: string }[];
  targetItem: string;
  sourceItem: string;
};
export type JavaAddonSpec = {
  edition: "java";
  title: string;
  description: string;
  kind: "recipe" | "script" | "resourcepack" | "loot";
  namespace: string;
  outputName: string;
  javaScript?: JavaScriptSpec;
  recipe?: JavaRecipeSpec;
  loot?: LootSpec;
  resourcepack?: ResourcepackSpec;
  unresolvedQuestions: string[];
  unsupportedRequests: string[];
};
export type AddonSpec = BedrockAddonSpec | JavaAddonSpec;

export const MC_ID = /^minecraft:[a-z0-9_]+$/;
export const MC_SOUND_ID = /^minecraft:[a-z0-9._]+$/;
export const MC_PATH_ID = MC_ID;
const NAMESPACE = /^[a-z][a-z0-9_]{0,31}$/;
const OUTPUT_NAME = /^[a-z0-9][a-z0-9_-]*$/;
const LANG_KEY = /^(item|block)\.minecraft\.[a-z0-9_]+$/;
const BEDROCK_EVENTS = ["itemUse", "blockBreak", "interval"] as const;
const CONDITIONS = ["always", "day", "night", "rain", "thunder"] as const;
const TRIGGERS = [
  "interval",
  "consumeItem",
  "placedBlock",
  "killEntity",
  "mineBlock",
  "death",
] as const;

export function createEmptySpec(edition: "bedrock"): BedrockAddonSpec;
export function createEmptySpec(edition: "java"): JavaAddonSpec;
export function createEmptySpec(edition?: Edition): AddonSpec;
export function createEmptySpec(edition: Edition = "bedrock"): AddonSpec {
  const common = {
    title: "",
    description: "",
    namespace: "my_addon",
    outputName: "my-addon",
  };
  return edition === "bedrock"
    ? {
        edition,
        ...common,
        kind: "recipe",
        unresolvedQuestions: ["どんなアドオンにしたいかを入力してください。"],
      }
    : {
        edition,
        ...common,
        kind: "recipe",
        unresolvedQuestions: ["どんなパックにしたいかを入力してください。"],
        unsupportedRequests: [],
      };
}
export const emptySpec: AddonSpec = createEmptySpec();

export function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
export function normalizeFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const JAVA_CAPABILITY_VALIDATORS: Record<JavaCapabilityId, true> = {
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

export function validateSpec(
  spec: AddonSpec,
  capabilities: readonly JavaCapabilityId[] = [],
  rule?: JavaVersionRule,
): string[] {
  const errors: string[] = [];
  if (!spec.title.trim()) errors.push("タイトルが未設定です。");
  if (!spec.description.trim()) errors.push("説明が未設定です。");
  if (!NAMESPACE.test(spec.namespace))
    errors.push(
      "namespace は英小文字から始まる1〜32文字の英数字・アンダースコアにしてください。",
    );
  if (!OUTPUT_NAME.test(spec.outputName))
    errors.push(
      "出力名は英小文字、数字、ハイフン、アンダースコアで指定してください。",
    );
  if (spec.edition === "bedrock") validateBedrock(spec, errors);
  else validateJava(spec, capabilities, rule, errors);
  return errors;
}

function validateBedrock(spec: BedrockAddonSpec, errors: string[]): void {
  if (!["recipe", "item", "script"].includes(spec.kind))
    errors.push("対応していない種類です。");
  if (spec.kind === "recipe") {
    const r = spec.recipe;
    if (!r) return void errors.push("レシピ情報が未設定です。");
    if (!r.resultItem.includes(":"))
      errors.push("完成アイテムIDは namespace:item の形にしてください。");
    if (!between(r.resultCount, 1, 64))
      errors.push("完成数は1から64にしてください。");
    if (!between(r.pattern.length, 1, 3))
      errors.push("レシピパターンは1から3行にしてください。");
    if (Object.keys(r.key).length < 1) errors.push("レシピ素材が未設定です。");
  } else if (spec.kind === "item") {
    if (!spec.item) return void errors.push("アイテム情報が未設定です。");
    if (!spec.item.identifier.includes(":"))
      errors.push("アイテムIDは namespace:item の形にしてください。");
    if (!between(spec.item.maxStackSize, 1, 64))
      errors.push("最大スタック数は1から64にしてください。");
  } else {
    if (!spec.script) return void errors.push("スクリプト情報が未設定です。");
    if (!BEDROCK_EVENTS.includes(spec.script.event))
      errors.push("対応していないイベントです。");
  }
}

function validateJava(
  spec: JavaAddonSpec,
  capabilities: readonly JavaCapabilityId[],
  rule: JavaVersionRule | undefined,
  errors: string[],
): void {
  const required = javaCapabilitiesForValidation(spec);
  for (const id of required)
    if (!capabilities.includes(id))
      errors.push(`現在のJava版では未対応の機能です: ${id}`);
  if (spec.kind === "recipe") validateJavaRecipe(spec.recipe, rule, errors);
  else if (spec.kind === "script") validateJavaScript(spec.javaScript, errors);
  else if (spec.kind === "loot") validateLoot(spec.loot, errors);
  else validateResourcepack(spec.resourcepack, errors);
}

function javaCapabilitiesForValidation(
  spec: JavaAddonSpec,
): JavaCapabilityId[] {
  if (spec.kind === "recipe") {
    const type = spec.recipe?.recipeType ?? "shaped";
    return [
      type === "shaped"
        ? "recipe.shaped"
        : type === "shapeless"
          ? "recipe.shapeless"
          : ["smelting", "blasting", "smoking", "campfire_cooking"].includes(
                type,
              )
            ? "recipe.cooking"
            : type === "stonecutting"
              ? "recipe.stonecutting"
              : "recipe.smithing",
    ];
  }
  if (spec.kind === "script" && spec.javaScript)
    return [
      `script.trigger.${spec.javaScript.trigger}` as JavaCapabilityId,
      ...spec.javaScript.actions.map(
        (action) => `script.action.${action.type}` as JavaCapabilityId,
      ),
    ];
  if (spec.kind === "loot") return ["loot.blockDrop"];
  return [
    spec.resourcepack?.pattern === "itemModelSwap"
      ? "resourcepack.itemModelSwap"
      : "resourcepack.lang",
  ];
}

function validateJavaRecipe(
  r: JavaRecipeSpec | undefined,
  rule: JavaVersionRule | undefined,
  errors: string[],
): void {
  if (!r) return void errors.push("レシピ情報が未設定です。");
  if (!MC_ID.test(r.resultItem))
    errors.push("Java版の完成アイテムは minecraft: のバニラIDにしてください。");
  if (r.recipeType === "shaped") {
    const lengths = r.pattern.map((row) => row.length);
    if (
      !between(r.pattern.length, 1, 3) ||
      lengths.some((n) => !between(n, 1, 3))
    )
      errors.push(
        "Java版のレシピパターンは1〜3行・各行1〜3文字にしてください。",
      );
    if (new Set(lengths).size > 1)
      errors.push("Java版のレシピパターンは全行を同じ幅にしてください。");
    const symbols = new Set(
      r.pattern
        .join("")
        .split("")
        .filter((s) => s !== " "),
    );
    if ([...symbols].some((s) => !(s in r.key)))
      errors.push("Java版のレシピパターンで未定義の素材記号を使用しています。");
    if (
      Object.keys(r.key).length < 1 ||
      Object.keys(r.key).some((s) => s.length !== 1) ||
      Object.values(r.key).some((id) => !MC_ID.test(id))
    )
      errors.push("Java版のレシピ素材記号とIDが不正です。");
  } else if (r.recipeType === "shapeless") {
    if (
      !between(r.ingredients.length, 1, 9) ||
      r.ingredients.some((id) => !MC_ID.test(id))
    )
      errors.push("不定形レシピの素材は1〜9個の minecraft: IDにしてください。");
  } else if (
    ["smelting", "blasting", "smoking", "campfire_cooking"].includes(
      r.recipeType,
    )
  ) {
    if (!MC_ID.test(r.inputItem))
      errors.push("かまど系レシピの素材IDが不正です。");
    if (!between(r.cookingXp, 0, 100))
      errors.push("経験値は0から100にしてください。");
    if (
      !Number.isInteger(r.cookingSeconds) ||
      !between(r.cookingSeconds, 1, 600)
    )
      errors.push("焼成時間は1から600秒にしてください。");
  } else if (r.recipeType === "stonecutting") {
    if (!MC_ID.test(r.inputItem))
      errors.push("石切台レシピの素材IDが不正です。");
  } else if (
    ![r.smithingTemplate, r.smithingBase, r.smithingAddition].every((id) =>
      MC_ID.test(id),
    )
  )
    errors.push("鍛冶台のテンプレート・ベース・追加素材IDが不正です。");
  if (r.recipeType === "smithing_transform" && r.resultCount !== 1)
    errors.push("鍛冶台レシピの完成数は1固定です。");
  else if (
    ["smelting", "blasting", "smoking", "campfire_cooking"].includes(
      r.recipeType,
    ) &&
    !rule?.cookingResultCount &&
    r.resultCount !== 1
  )
    errors.push("このJava版ではかまど系レシピの完成数は1固定です。");
  else if (!between(r.resultCount, 1, 64))
    errors.push("完成数は1から64にしてください。");
}

function validateJavaScript(
  s: JavaScriptSpec | undefined,
  errors: string[],
): void {
  if (!s) return void errors.push("Javaスクリプト情報が未設定です。");
  if (!TRIGGERS.includes(s.trigger))
    errors.push("対応していないJavaトリガーです。");
  if (!CONDITIONS.includes(s.condition))
    errors.push("対応していない発火条件です。");
  if (!between(s.actions.length, 1, 3))
    errors.push("アクションは1から3件にしてください。");
  if (
    s.trigger === "interval" &&
    (!Number.isInteger(s.intervalSeconds) ||
      !between(s.intervalSeconds, 5, 3600))
  )
    errors.push("Java版の実行間隔は5秒から3600秒にしてください。");
  if (s.trigger === "consumeItem" && !MC_ID.test(s.triggerItemId))
    errors.push("食べるアイテムIDが不正です。");
  if (
    ["placedBlock", "mineBlock"].includes(s.trigger) &&
    !MC_PATH_ID.test(s.triggerBlockId)
  )
    errors.push("対象ブロックIDが不正です。");
  if (s.trigger === "killEntity" && !MC_ID.test(s.triggerEntityId))
    errors.push("対象エンティティIDが不正です。");
  for (const a of s.actions) {
    if (["message", "title", "actionbar"].includes(a.type) && !a.text.trim())
      errors.push(`${a.type} の文言が未設定です。`);
    if (a.type === "effect") {
      if (
        !MC_ID.test(a.effectId) ||
        !Number.isInteger(a.effectSeconds) ||
        !between(a.effectSeconds, 1, 1_000_000) ||
        !Number.isInteger(a.effectAmplifier) ||
        !between(a.effectAmplifier, 0, 9)
      )
        errors.push("エフェクト設定が不正です。");
      if (s.trigger === "interval" && a.effectSeconds < s.intervalSeconds + 15)
        errors.push("定期エフェクトの秒数は実行間隔+15秒以上にしてください。");
    }
    if (a.type === "playsound" && !MC_SOUND_ID.test(a.soundId))
      errors.push("サウンドIDが不正です。");
    if (a.type === "setTime" && !a.timeValue)
      errors.push("固定する時刻が未設定です。");
    if (a.type === "setWeather" && !a.weatherValue)
      errors.push("固定する天候が未設定です。");
  }
}

function validateLoot(loot: LootSpec | undefined, errors: string[]): void {
  if (!loot) return void errors.push("ドロップ情報が未設定です。");
  if (!MC_PATH_ID.test(loot.targetBlockId))
    errors.push("対象ブロックIDが不正です。");
  if (!MC_ID.test(loot.dropItemId))
    errors.push("ドロップアイテムIDが不正です。");
  if (!Number.isInteger(loot.dropCount) || !between(loot.dropCount, 1, 64))
    errors.push("ドロップ数は1から64にしてください。");
}

function validateResourcepack(
  resource: ResourcepackSpec | undefined,
  errors: string[],
): void {
  if (!resource) return void errors.push("リソースパック情報が未設定です。");
  if (resource.pattern === "itemModelSwap") {
    if (
      !MC_PATH_ID.test(resource.targetItem) ||
      !MC_PATH_ID.test(resource.sourceItem)
    )
      errors.push("モデル差し替えのアイテムIDが不正です。");
    if (resource.targetItem === resource.sourceItem)
      errors.push("差し替え元と先は別のアイテムにしてください。");
    return;
  }
  const keys = resource.langEntries.map((entry) => entry.key);
  if (
    keys.length < 1 ||
    new Set(keys).size !== keys.length ||
    resource.langEntries.some(
      (entry) => !LANG_KEY.test(entry.key) || !entry.value.trim(),
    )
  )
    errors.push("表示名の変更内容が不正です。");
}

function between(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export type SpecCheck = {
  key: string;
  label: string;
  value: string;
  ok: boolean;
};
export function specChecks(
  spec: AddonSpec,
  capabilities: readonly JavaCapabilityId[] = [],
  rule?: JavaVersionRule,
): SpecCheck[] {
  const errors = validateSpec(spec, capabilities, rule);
  const result: SpecCheck[] = [
    {
      key: "kind",
      label: "種類",
      value: spec.kind,
      ok: !errors.some((e) => e.includes("種類") || e.includes("未対応の機能")),
    },
    {
      key: "title",
      label: "名前",
      value: spec.title.trim(),
      ok: !!spec.title.trim(),
    },
    {
      key: "description",
      label: "説明",
      value: spec.description.trim(),
      ok: !!spec.description.trim(),
    },
  ];
  if (spec.edition === "java") result.push(...javaDetailChecks(spec, errors));
  else result.push(...bedrockDetailChecks(spec, errors));
  result.push(
    {
      key: "namespace",
      label: "namespace",
      value: spec.namespace,
      ok: NAMESPACE.test(spec.namespace),
    },
    {
      key: "outputName",
      label: "出力名",
      value: spec.outputName,
      ok: OUTPUT_NAME.test(spec.outputName),
    },
  );
  if (errors.length > 0 && result.every((check) => check.ok))
    result.push({
      key: "validation",
      label: "入力確認",
      value: errors.join(" / "),
      ok: false,
    });
  return result;
}

function bedrockDetailChecks(
  spec: BedrockAddonSpec,
  errors: string[],
): SpecCheck[] {
  if (spec.kind === "recipe")
    return [
      {
        key: "recipe",
        label: "レシピ",
        value: spec.recipe?.resultItem ?? "",
        ok: !!spec.recipe && !errors.some((e) => /レシピ|完成/.test(e)),
      },
    ];
  if (spec.kind === "item")
    return [
      {
        key: "item",
        label: "アイテム",
        value: spec.item?.identifier ?? "",
        ok: !!spec.item && !errors.some((e) => /アイテム|スタック/.test(e)),
      },
    ];
  return [
    {
      key: "event",
      label: "イベント",
      value: spec.script?.event ?? "",
      ok: !!spec.script && !errors.some((e) => /イベント|スクリプト/.test(e)),
    },
  ];
}

function javaDetailChecks(spec: JavaAddonSpec, errors: string[]): SpecCheck[] {
  if (spec.kind === "recipe")
    return [
      {
        key: "recipeType",
        label: "レシピ種類",
        value: spec.recipe?.recipeType ?? "",
        ok:
          !!spec.recipe &&
          !errors.some((e) => /レシピ|完成数|素材|焼成|経験値/.test(e)),
      },
      {
        key: "resultItem",
        label: "完成品",
        value: spec.recipe?.resultItem ?? "",
        ok: !!spec.recipe && MC_ID.test(spec.recipe.resultItem),
      },
    ];
  if (spec.kind === "script")
    return [
      {
        key: "trigger",
        label: "トリガー",
        value: spec.javaScript?.trigger ?? "",
        ok:
          !!spec.javaScript &&
          !errors.some((e) => /トリガー|実行間隔|対象.*ID|食べる/.test(e)),
      },
      {
        key: "condition",
        label: "条件",
        value: spec.javaScript?.condition ?? "",
        ok: !!spec.javaScript && CONDITIONS.includes(spec.javaScript.condition),
      },
      {
        key: "actions",
        label: "アクション",
        value: spec.javaScript ? `${spec.javaScript.actions.length}件` : "",
        ok:
          !!spec.javaScript &&
          !errors.some((e) =>
            /アクション|エフェクト|文言|サウンド|時刻|天候/.test(e),
          ),
      },
    ];
  if (spec.kind === "loot")
    return [
      {
        key: "loot",
        label: "ドロップ",
        value: spec.loot
          ? `${spec.loot.targetBlockId} → ${spec.loot.dropItemId}×${spec.loot.dropCount}`
          : "",
        ok: !!spec.loot && !errors.some((e) => /ドロップ|ブロックID/.test(e)),
      },
    ];
  return [
    {
      key: "resourcepack",
      label: "パターン",
      value: spec.resourcepack?.pattern ?? "",
      ok:
        !!spec.resourcepack &&
        !errors.some((e) => /表示名|モデル差し替え|アイテムID/.test(e)),
    },
  ];
}

export function objectiveName(
  namespace: string,
  trigger: JavaScriptTrigger,
  triggerBlockId: string,
): string {
  return `acb_${sha1(`${namespace}:${trigger}:${triggerBlockId}`).slice(0, 11)}`;
}

function sha1(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++)
    words[i >> 2] = (words[i >> 2] ?? 0) | (bytes[i] << (24 - (i % 4) * 8));
  words[bytes.length >> 2] =
    (words[bytes.length >> 2] ?? 0) | (0x80 << (24 - (bytes.length % 4) * 8));
  words[(((bytes.length + 8) >> 6) + 1) * 16 - 1] = bytes.length * 8;
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  for (let i = 0; i < words.length; i += 16) {
    const w = new Array<number>(80);
    for (let j = 0; j < 16; j++) w[j] = words[i + j] ?? 0;
    for (let j = 16; j < 80; j++) {
      const x = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (x << 1) | (x >>> 31);
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let j = 0; j < 80; j++) {
      const f =
        j < 20
          ? (b & c) | (~b & d)
          : j < 40
            ? b ^ c ^ d
            : j < 60
              ? (b & c) | (b & d) | (c & d)
              : b ^ c ^ d;
      const k =
        j < 20
          ? 0x5a827999
          : j < 40
            ? 0x6ed9eba1
            : j < 60
              ? 0x8f1bbcdc
              : 0xca62c1d6;
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4]
    .map((n) => (n >>> 0).toString(16).padStart(8, "0"))
    .join("");
}
