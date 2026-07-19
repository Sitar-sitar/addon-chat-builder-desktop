import type { JavaVersionRule } from "./pack-rules";
import type { AddonKind, AddonSpec, JavaAddonSpec } from "./spec";

export type JavaCapabilityId =
  | "recipe.shaped"
  | "recipe.shapeless"
  | "recipe.cooking"
  | "recipe.stonecutting"
  | "recipe.smithing"
  | "script.trigger.interval"
  | "script.trigger.consumeItem"
  | "script.trigger.placedBlock"
  | "script.trigger.killEntity"
  | "script.trigger.mineBlock"
  | "script.trigger.death"
  | "script.action.message"
  | "script.action.effect"
  | "script.action.title"
  | "script.action.actionbar"
  | "script.action.playsound"
  | "script.action.setTime"
  | "script.action.setWeather"
  | "loot.blockDrop"
  | "resourcepack.lang"
  | "resourcepack.itemModelSwap";

export type JavaCapability = {
  id: JavaCapabilityId;
  kind: AddonKind;
  phase: 0 | 1 | 2 | 3 | 4 | 5;
  requires?: (keyof JavaVersionRule)[];
  label: string;
  promptLine: string;
  starterPrompt?: string;
};

export const RELEASED_JAVA_PHASE: 0 | 1 | 2 | 3 | 4 | 5 = 5;

export const JAVA_CAPABILITIES = [
  c(
    "recipe.shaped",
    "recipe",
    0,
    "定型レシピ",
    "作業台の形付きレシピ。完成品、個数、3x3以内の形と素材を確認する。",
    "新しい武器レシピを作りたい",
  ),
  c(
    "recipe.shapeless",
    "recipe",
    2,
    "不定形レシピ",
    "作業台の不定形レシピ。完成品、個数、1〜9個の素材を確認する。",
  ),
  c(
    "recipe.cooking",
    "recipe",
    2,
    "かまど系レシピ",
    "かまど・溶鉱炉・燻製器・焚き火。素材、完成品、経験値、時間を確認する。",
    "金インゴットを焼いて作りたい",
  ),
  c(
    "recipe.stonecutting",
    "recipe",
    2,
    "石切台レシピ",
    "石切台レシピ。素材、完成品、個数を確認する。",
  ),
  c(
    "recipe.smithing",
    "recipe",
    2,
    "鍛冶台変換",
    "鍛冶台の素材変換。テンプレート、ベース、追加素材、完成品を確認する。",
  ),
  c(
    "script.trigger.interval",
    "script",
    1,
    "定期実行",
    "5〜3600秒間隔の定期実行。未指定は60秒を提案する。",
  ),
  c(
    "script.trigger.consumeItem",
    "script",
    3,
    "食べた時",
    "指定アイテムを食べた時に実行する。",
    "りんごを食べたら回復エフェクト",
  ),
  c(
    "script.trigger.placedBlock",
    "script",
    3,
    "設置した時",
    "指定ブロックを設置した時に実行する。",
  ),
  c(
    "script.trigger.killEntity",
    "script",
    3,
    "討伐した時",
    "指定エンティティを倒した時に実行する。",
  ),
  c(
    "script.trigger.mineBlock",
    "script",
    3,
    "採掘した時",
    "指定ブロックを掘った時に最大1秒遅延で実行する。",
  ),
  c(
    "script.trigger.death",
    "script",
    3,
    "死亡した時",
    "プレイヤーが死亡した時に最大1秒遅延で実行する。",
  ),
  c(
    "script.action.message",
    "script",
    1,
    "チャット通知",
    "チャットへ固定文を表示する。",
  ),
  c(
    "script.action.effect",
    "script",
    1,
    "エフェクト付与",
    "エフェクトID、秒数、強さを確認する。",
    "夜だけ暗視をつけたい",
  ),
  c(
    "script.action.title",
    "script",
    1,
    "タイトル表示",
    "画面中央へ固定文を表示する。",
  ),
  c(
    "script.action.actionbar",
    "script",
    1,
    "アクションバー表示",
    "アクションバーへ固定文を表示する。",
  ),
  c(
    "script.action.playsound",
    "script",
    1,
    "サウンド再生",
    "minecraft: のサウンドIDを確認する。",
  ),
  c(
    "script.action.setTime",
    "script",
    4,
    "時刻固定",
    "時刻を day/night/noon/midnight のいずれかへ固定する。",
  ),
  c(
    "script.action.setWeather",
    "script",
    4,
    "天候固定",
    "天候を clear/rain/thunder のいずれかへ固定する。",
  ),
  c(
    "loot.blockDrop",
    "loot",
    4,
    "ブロックドロップ差し替え",
    "対象ブロックのドロップを完全上書きする。シルクタッチ・幸運の元挙動は失われる。",
    "石を掘ったら金を落としたい",
  ),
  c(
    "resourcepack.lang",
    "resourcepack",
    0,
    "表示名変更",
    "item.minecraft.* または block.minecraft.* の表示名を変更する。",
    "アイテムの表示名を変えたい",
  ),
  {
    ...c(
      "resourcepack.itemModelSwap",
      "resourcepack",
      5,
      "アイテムモデル差し替え",
      "バニラアイテムの見た目を別のバニラモデルへ差し替える。",
      "ダイヤ剣を別の見た目にしたい",
    ),
    requires: ["itemModelDefinitions"],
  },
] as const satisfies readonly JavaCapability[];

function c(
  id: JavaCapabilityId,
  kind: AddonKind,
  phase: JavaCapability["phase"],
  label: string,
  promptLine: string,
  starterPrompt?: string,
): JavaCapability {
  return {
    id,
    kind,
    phase,
    label,
    promptLine,
    ...(starterPrompt ? { starterPrompt } : {}),
  };
}

export function enabledJavaCapabilities(
  rule: JavaVersionRule,
  releasedPhase: number = RELEASED_JAVA_PHASE,
): JavaCapability[] {
  return JAVA_CAPABILITIES.filter(
    (capability) =>
      capability.phase <= releasedPhase &&
      (capability.requires ?? []).every((key) => rule[key] === true),
  );
}

export function capabilitiesForSpec(spec: AddonSpec): JavaCapabilityId[] {
  if (spec.edition !== "java") return [];
  if (spec.kind === "recipe") {
    const recipeType = spec.recipe?.recipeType ?? "shaped";
    if (recipeType === "shaped") return ["recipe.shaped"];
    if (recipeType === "shapeless") return ["recipe.shapeless"];
    if (
      ["smelting", "blasting", "smoking", "campfire_cooking"].includes(
        recipeType,
      )
    )
      return ["recipe.cooking"];
    if (recipeType === "stonecutting") return ["recipe.stonecutting"];
    return ["recipe.smithing"];
  }
  if (spec.kind === "script") {
    if (!spec.javaScript) return [];
    return [
      `script.trigger.${spec.javaScript.trigger}` as JavaCapabilityId,
      ...spec.javaScript.actions.map(
        (action) => `script.action.${action.type}` as JavaCapabilityId,
      ),
    ];
  }
  if (spec.kind === "loot") return ["loot.blockDrop"];
  return [
    spec.resourcepack?.pattern === "itemModelSwap"
      ? "resourcepack.itemModelSwap"
      : "resourcepack.lang",
  ];
}

export function starterPromptsForCapabilities(
  ids: readonly JavaCapabilityId[],
): string[] {
  const enabled = new Set(ids);
  return JAVA_CAPABILITIES.filter(
    (capability) => enabled.has(capability.id) && capability.starterPrompt,
  ).map((capability) => capability.starterPrompt as string);
}

export function javaSpec(spec: AddonSpec): JavaAddonSpec | undefined {
  return spec.edition === "java" ? spec : undefined;
}
