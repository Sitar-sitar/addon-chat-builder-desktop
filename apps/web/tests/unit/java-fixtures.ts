import { enabledJavaCapabilities } from "../../src/lib/pattern-catalog";
import { JAVA_VERSIONS } from "../../src/lib/pack-rules";
import type {
  JavaAddonSpec,
  JavaRecipeSpec,
  JavaScriptAction,
} from "../../src/lib/spec";

export const emptyAction = (
  type: JavaScriptAction["type"] = "message",
): JavaScriptAction => ({
  type,
  text: ["message", "title", "actionbar"].includes(type) ? "休憩しよう" : "",
  effectId: "minecraft:night_vision",
  effectSeconds: 75,
  effectAmplifier: 0,
  soundId: "minecraft:block.note_block.bell",
  timeValue: type === "setTime" ? "day" : "",
  weatherValue: type === "setWeather" ? "clear" : "",
});

export const shapedRecipe = (): JavaRecipeSpec => ({
  recipeType: "shaped",
  resultItem: "minecraft:diamond_sword",
  resultCount: 1,
  pattern: [" # ", " # ", " S "],
  key: { "#": "minecraft:diamond", S: "minecraft:stick" },
  ingredients: [],
  inputItem: "",
  cookingXp: 0.1,
  cookingSeconds: 10,
  smithingTemplate: "",
  smithingBase: "",
  smithingAddition: "",
});

export const javaSpec = (
  overrides: Partial<JavaAddonSpec> = {},
): JavaAddonSpec => ({
  edition: "java",
  title: "Javaパック",
  description: "会話用説明",
  kind: "recipe",
  namespace: "test_pack",
  outputName: "test-pack",
  recipe: shapedRecipe(),
  unresolvedQuestions: [],
  unsupportedRequests: [],
  ...overrides,
});

export const javaScriptSpec = (
  overrides: Partial<NonNullable<JavaAddonSpec["javaScript"]>> = {},
): JavaAddonSpec =>
  javaSpec({
    kind: "script",
    recipe: undefined,
    javaScript: {
      trigger: "interval",
      intervalSeconds: 60,
      condition: "always",
      actions: [emptyAction()],
      triggerItemId: "",
      triggerEntityId: "",
      triggerBlockId: "",
      summary: "定期通知",
      ...overrides,
    },
  });

export const caps = (version = "1.21.7") =>
  enabledJavaCapabilities(JAVA_VERSIONS[version]).map((c) => c.id);
