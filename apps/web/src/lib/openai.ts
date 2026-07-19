import {
  createEmptySpec,
  type AddonSpec,
  type BedrockAddonSpec,
  type Edition,
  type JavaAddonSpec,
  type JavaRecipeSpec,
  type JavaScriptAction,
} from "./spec";
import { getEnvValue } from "./env";
import { enabledJavaCapabilities } from "./pattern-catalog";
import { resolveJavaVersion, type GeneratedPackFile } from "./pack-rules";

type ChatInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  edition: Edition;
  currentSpec?: AddonSpec;
};
type ChatResult = {
  assistantMessage: string;
  spec: AddonSpec;
  suggestedReplies: string[];
  recommendedReply: string;
};
type RawEnvelope = {
  assistantMessage: string;
  spec: Record<string, any>;
  suggestedReplies: string[];
  recommendedReply: string;
};

const string = { type: "string" };
const number = { type: "number" };
const langEntries = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["key", "value"],
    properties: { key: string, value: string },
  },
};
const commonProperties = {
  edition: { type: "string", enum: ["bedrock", "java"] },
  title: string,
  description: string,
  kind: { type: "string" },
  namespace: string,
  outputName: string,
  unresolvedQuestions: { type: "array", items: string },
};

export const bedrockChatResponseSchema = envelopeSchema(
  {
    ...commonProperties,
    kind: {
      type: "string",
      enum: ["recipe", "item", "script", "resourcepack"],
    },
    recipe: {
      type: "object",
      additionalProperties: false,
      required: ["resultItem", "resultCount", "pattern", "ingredients"],
      properties: {
        resultItem: string,
        resultCount: number,
        pattern: { type: "array", items: string },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["symbol", "item"],
            properties: { symbol: string, item: string },
          },
        },
      },
    },
    item: {
      type: "object",
      additionalProperties: false,
      required: ["identifier", "displayName", "maxStackSize"],
      properties: {
        identifier: string,
        displayName: string,
        maxStackSize: number,
      },
    },
    script: {
      type: "object",
      additionalProperties: false,
      required: ["event", "summary", "message", "intervalSeconds"],
      properties: {
        event: { type: "string", enum: ["itemUse", "blockBreak", "interval"] },
        summary: string,
        message: string,
        intervalSeconds: number,
      },
    },
    resourcepack: {
      type: "object",
      additionalProperties: false,
      required: ["langEntries"],
      properties: { langEntries },
    },
  },
  [
    "edition",
    "title",
    "description",
    "kind",
    "namespace",
    "outputName",
    "recipe",
    "item",
    "script",
    "resourcepack",
    "unresolvedQuestions",
  ],
);
export const chatResponseSchema = bedrockChatResponseSchema;

const actionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "type",
    "text",
    "effectId",
    "effectSeconds",
    "effectAmplifier",
    "soundId",
    "timeValue",
    "weatherValue",
  ],
  properties: {
    type: {
      type: "string",
      enum: [
        "message",
        "effect",
        "title",
        "actionbar",
        "playsound",
        "setTime",
        "setWeather",
      ],
    },
    text: string,
    effectId: string,
    effectSeconds: number,
    effectAmplifier: number,
    soundId: string,
    timeValue: {
      type: "string",
      enum: ["day", "night", "noon", "midnight", ""],
    },
    weatherValue: { type: "string", enum: ["clear", "rain", "thunder", ""] },
  },
};
export const javaChatResponseSchema = envelopeSchema(
  {
    ...commonProperties,
    kind: {
      type: "string",
      enum: ["recipe", "script", "resourcepack", "loot"],
    },
    unsupportedRequests: { type: "array", items: string },
    recipe: {
      type: "object",
      additionalProperties: false,
      required: [
        "recipeType",
        "resultItem",
        "resultCount",
        "pattern",
        "ingredients",
        "inputItem",
        "cookingXp",
        "cookingSeconds",
        "smithingTemplate",
        "smithingBase",
        "smithingAddition",
        "keyEntries",
      ],
      properties: {
        recipeType: {
          type: "string",
          enum: [
            "shaped",
            "shapeless",
            "smelting",
            "blasting",
            "smoking",
            "campfire_cooking",
            "stonecutting",
            "smithing_transform",
          ],
        },
        resultItem: string,
        resultCount: number,
        pattern: { type: "array", items: string },
        ingredients: { type: "array", items: string },
        inputItem: string,
        cookingXp: number,
        cookingSeconds: number,
        smithingTemplate: string,
        smithingBase: string,
        smithingAddition: string,
        keyEntries: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["symbol", "item"],
            properties: { symbol: string, item: string },
          },
        },
      },
    },
    javaScript: {
      type: "object",
      additionalProperties: false,
      required: [
        "trigger",
        "intervalSeconds",
        "condition",
        "actions",
        "triggerItemId",
        "triggerEntityId",
        "triggerBlockId",
        "summary",
      ],
      properties: {
        trigger: {
          type: "string",
          enum: [
            "interval",
            "consumeItem",
            "placedBlock",
            "killEntity",
            "mineBlock",
            "death",
          ],
        },
        intervalSeconds: number,
        condition: {
          type: "string",
          enum: ["always", "day", "night", "rain", "thunder"],
        },
        actions: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: actionSchema,
        },
        triggerItemId: string,
        triggerEntityId: string,
        triggerBlockId: string,
        summary: string,
      },
    },
    loot: {
      type: "object",
      additionalProperties: false,
      required: ["targetBlockId", "dropItemId", "dropCount"],
      properties: {
        targetBlockId: string,
        dropItemId: string,
        dropCount: number,
      },
    },
    resourcepack: {
      type: "object",
      additionalProperties: false,
      required: ["pattern", "langEntries", "targetItem", "sourceItem"],
      properties: {
        pattern: { type: "string", enum: ["lang", "itemModelSwap"] },
        langEntries,
        targetItem: string,
        sourceItem: string,
      },
    },
  },
  [
    "edition",
    "title",
    "description",
    "kind",
    "namespace",
    "outputName",
    "recipe",
    "javaScript",
    "loot",
    "resourcepack",
    "unresolvedQuestions",
    "unsupportedRequests",
  ],
);

function envelopeSchema(
  specProperties: Record<string, unknown>,
  required: string[],
) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "assistantMessage",
      "spec",
      "suggestedReplies",
      "recommendedReply",
    ],
    properties: {
      assistantMessage: string,
      spec: {
        type: "object",
        additionalProperties: false,
        required,
        properties: specProperties,
      },
      suggestedReplies: { type: "array", maxItems: 4, items: string },
      recommendedReply: string,
    },
  };
}

export async function refineAddonSpec(input: ChatInput): Promise<ChatResult> {
  const apiKey = getEnvValue("OPENAI_API_KEY");
  if (!apiKey)
    throw new Error(
      "OPENAI_API_KEY が未設定です。.env または API.env を確認してください。",
    );
  const model =
    getEnvValue("OPENAI_CHAT_MODEL") ||
    getEnvValue("OPENAI_MODEL") ||
    "gpt-5.4-mini";
  const currentSpec = input.currentSpec
    ? { ...input.currentSpec, edition: input.edition }
    : createEmptySpec(input.edition);
  const java = input.edition === "java";
  const enabled = java
    ? enabledJavaCapabilities(resolveJavaVersion().rule)
    : [];
  const editionPrompt = java
    ? [
        "あなたはMinecraft Java Editionの小規模パック作成を支援する設計担当です。",
        "対応範囲:",
        ...enabled.map((c) => `- ${c.promptLine}`),
        "カタログに無い要望は『このツールでは未対応』と明言し unsupportedRequests に『未対応: <要望>』を追加してください。未対応要望をmessageやdescriptionで実現したことにしないでください。",
        "近い対応があれば suggestedReplies で代替案を提示してください。4件以上のアクションは削らず、3件以内に絞る質問を unresolvedQuestions に残してください。",
      ]
    : [
        "あなたはMinecraft Bedrock Editionの小規模アドオン作成を支援する設計担当です。",
        "初期版の対応範囲は recipe, item, script の3種類だけです。",
      ];
  const response = await fetchOpenAiResponse({
    apiKey,
    models: getModelList(model, "OPENAI_CHAT_FALLBACK_MODELS"),
    errorLabel: "OpenAI API エラー",
    buildBody: (selectedModel) => ({
      model: selectedModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                ...editionPrompt,
                "ユーザーの曖昧な希望を実装可能な仕様へ短く具体化してください。",
                "不明点は unresolvedQuestions に残してください。strict schema の全項目を安全な既定値で埋めてください。",
                "namespace と outputName は許容文字へ正規化してください。",
                "IDは minecraft: で始まるバニラIDを使ってください。",
                "assistantMessage 冒頭で希望を一度だけ短く言い換えてください。",
                "回答候補は suggestedReplies に2〜4個・各12文字以内、推奨値は recommendedReply に入れてください。",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                currentSpec,
                conversation: input.messages,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "addon_chat_result",
          strict: true,
          schema: java ? javaChatResponseSchema : bedrockChatResponseSchema,
        },
      },
    }),
  });
  const parsed = JSON.parse(
    extractOutputText(await response.json()),
  ) as RawEnvelope;
  const replies = normalizeSuggestedReplies(parsed.suggestedReplies);
  const recommended = (parsed.recommendedReply ?? "").trim();
  return {
    assistantMessage: parsed.assistantMessage,
    spec: java
      ? normalizeJavaRawSpec(parsed.spec)
      : normalizeBedrockRawSpec(parsed.spec),
    suggestedReplies: replies,
    recommendedReply: replies.includes(recommended) ? recommended : "",
  };
}

export type LegacyBedrockCodexSpec = Omit<BedrockAddonSpec, "edition"> & {
  edition: "bedrock";
};
export function toLegacyBedrockCodexSpec(
  spec: BedrockAddonSpec,
): LegacyBedrockCodexSpec {
  return {
    edition: "bedrock",
    title: spec.title,
    description: spec.description,
    kind: spec.kind,
    namespace: spec.namespace,
    outputName: spec.outputName,
    recipe: spec.recipe,
    item: spec.item,
    script: spec.script,
    unresolvedQuestions: spec.unresolvedQuestions,
  };
}
export function codexUserInputText(spec: BedrockAddonSpec): string {
  return JSON.stringify({ spec: toLegacyBedrockCodexSpec(spec) });
}

export async function generateAddonFilesWithCodex(
  spec: BedrockAddonSpec,
): Promise<GeneratedPackFile[]> {
  const apiKey = getEnvValue("OPENAI_API_KEY");
  if (!apiKey)
    throw new Error(
      "OPENAI_API_KEY が未設定です。.env または API.env を確認してください。",
    );
  const model = getEnvValue("OPENAI_CODE_MODEL") || "gpt-5.2-codex";
  const response = await fetchOpenAiResponse({
    apiKey,
    models: getModelList(model, "OPENAI_CODE_FALLBACK_MODELS"),
    errorLabel: "Codex API エラー",
    buildBody: (selectedModel) => ({
      model: selectedModel,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "あなたはMinecraft Bedrock Editionのアドオン実装担当です。",
                "入力仕様から、配布用Behavior Packのファイル一式を生成してください。",
                "返答はJSONのみです。説明文やMarkdownは含めないでください。",
                "ファイルパスはpackルートからの相対パスだけにしてください。",
                "許可パスは manifest.json, README.txt, recipes/*.json, items/*.json, scripts/*.js です。",
                "manifest.json は必須です。",
                "Script APIを使う場合は @minecraft/server 2.6.0 を使ってください。",
                "危険なOS操作、外部通信、eval、Function constructor、ファイルアクセスコードは書かないでください。",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: codexUserInputText(spec) }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "codex_addon_files",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["files"],
            properties: {
              files: {
                type: "array",
                minItems: 2,
                maxItems: 12,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["path", "content"],
                  properties: { path: string, content: string },
                },
              },
            },
          },
        },
      },
    }),
  });
  return (
    JSON.parse(extractOutputText(await response.json())) as {
      files: GeneratedPackFile[];
    }
  ).files;
}

type OpenAiResponseRequest = {
  apiKey: string;
  models: string[];
  errorLabel: string;
  buildBody: (model: string) => unknown;
};
async function fetchOpenAiResponse({
  apiKey,
  models,
  errorLabel,
  buildBody,
}: OpenAiResponseRequest): Promise<Response> {
  let last = "モデル候補が未設定です。";
  for (const model of models) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildBody(model)),
      });
      if (response.ok) return response;
      last = `${response.status} ${await response.text()}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`${errorLabel}: ${last}`);
}
function getModelList(primary: string, fallback: string): string[] {
  const seen = new Set<string>();
  return [
    primary,
    ...(getEnvValue(fallback) ?? "").split(",").map((v) => v.trim()),
  ].filter((v) => !!v && !seen.has(v) && !!seen.add(v));
}
function normalizeSuggestedReplies(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => !!v && !seen.has(v) && !!seen.add(v))
    .slice(0, 4);
}
function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output ?? [])
    for (const part of item?.content ?? [])
      if (typeof part?.text === "string") return part.text;
  throw new Error("OpenAI API のテキスト出力が見つかりません。");
}

export function normalizeRawSpec(
  raw: Record<string, any>,
  lockedEdition: Edition,
): AddonSpec {
  return lockedEdition === "java"
    ? normalizeJavaRawSpec(raw)
    : normalizeBedrockRawSpec(raw);
}
export function normalizeBedrockRawSpec(
  raw: Record<string, any>,
): BedrockAddonSpec {
  const key = Object.fromEntries(
    (raw.recipe?.ingredients ?? [])
      .filter((i: any) => i.symbol?.trim() && i.item?.trim())
      .map((i: any) => [i.symbol.trim(), i.item.trim()]),
  );
  return {
    edition: "bedrock",
    title: raw.title ?? "",
    description: raw.description ?? "",
    kind: ["recipe", "item", "script"].includes(raw.kind) ? raw.kind : "recipe",
    namespace: raw.namespace ?? "",
    outputName: raw.outputName ?? "",
    recipe:
      raw.kind === "recipe"
        ? {
            resultItem: raw.recipe.resultItem,
            resultCount: raw.recipe.resultCount,
            pattern: raw.recipe.pattern,
            key,
          }
        : undefined,
    item: raw.kind === "item" ? raw.item : undefined,
    script: raw.kind === "script" ? raw.script : undefined,
    unresolvedQuestions: raw.unresolvedQuestions ?? [],
  };
}
export function normalizeJavaRawSpec(raw: Record<string, any>): JavaAddonSpec {
  const key = Object.fromEntries(
    (raw.recipe?.keyEntries ?? [])
      .filter((i: any) => i.symbol?.trim() && i.item?.trim())
      .map((i: any) => [i.symbol.trim(), i.item.trim()]),
  );
  const recipe: JavaRecipeSpec = {
    recipeType: raw.recipe?.recipeType ?? "shaped",
    resultItem: raw.recipe?.resultItem ?? "",
    resultCount: raw.recipe?.resultCount ?? 1,
    pattern: raw.recipe?.pattern ?? [],
    key,
    ingredients: raw.recipe?.ingredients ?? [],
    inputItem: raw.recipe?.inputItem ?? "",
    cookingXp: raw.recipe?.cookingXp ?? 0.1,
    cookingSeconds: raw.recipe?.cookingSeconds ?? 10,
    smithingTemplate: raw.recipe?.smithingTemplate ?? "",
    smithingBase: raw.recipe?.smithingBase ?? "",
    smithingAddition: raw.recipe?.smithingAddition ?? "",
  };
  return {
    edition: "java",
    title: raw.title ?? "",
    description: raw.description ?? "",
    kind: ["recipe", "script", "resourcepack", "loot"].includes(raw.kind)
      ? raw.kind
      : "recipe",
    namespace: raw.namespace ?? "",
    outputName: raw.outputName ?? "",
    recipe: raw.kind === "recipe" ? recipe : undefined,
    javaScript:
      raw.kind === "script"
        ? {
            ...raw.javaScript,
            actions: (raw.javaScript?.actions ?? []) as JavaScriptAction[],
          }
        : undefined,
    loot: raw.kind === "loot" ? raw.loot : undefined,
    resourcepack: raw.kind === "resourcepack" ? raw.resourcepack : undefined,
    unresolvedQuestions: raw.unresolvedQuestions ?? [],
    unsupportedRequests: raw.unsupportedRequests ?? [],
  };
}
