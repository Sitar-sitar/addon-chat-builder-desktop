import { AddonSpec, emptySpec } from "./spec";
import { getEnvValue } from "./env";

type ChatInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  currentSpec?: AddonSpec;
};

type ChatResult = {
  assistantMessage: string;
  spec: AddonSpec;
  suggestedReplies: string[];
  recommendedReply: string;
};

type RawChatResult = {
  assistantMessage: string;
  spec: {
    title: string;
    description: string;
    kind: "recipe" | "item" | "script";
    namespace: string;
    outputName: string;
    recipe: {
      resultItem: string;
      resultCount: number;
      pattern: string[];
      ingredients: { symbol: string; item: string }[];
    };
    item: {
      identifier: string;
      displayName: string;
      maxStackSize: number;
    };
    script: {
      event: "itemUse" | "blockBreak" | "interval";
      summary: string;
      message: string;
    };
    unresolvedQuestions: string[];
  };
  suggestedReplies: string[];
  recommendedReply: string;
};

export type GeneratedAddonFile = {
  path: string;
  content: string;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["assistantMessage", "spec", "suggestedReplies", "recommendedReply"],
  properties: {
    assistantMessage: { type: "string" },
    spec: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "description",
        "kind",
        "namespace",
        "outputName",
        "recipe",
        "item",
        "script",
        "unresolvedQuestions"
      ],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        kind: { type: "string", enum: ["recipe", "item", "script"] },
        namespace: { type: "string" },
        outputName: { type: "string" },
        recipe: {
          type: "object",
          additionalProperties: false,
          required: ["resultItem", "resultCount", "pattern", "ingredients"],
          properties: {
            resultItem: { type: "string" },
            resultCount: { type: "number" },
            pattern: { type: "array", items: { type: "string" } },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["symbol", "item"],
                properties: {
                  symbol: { type: "string" },
                  item: { type: "string" }
                }
              }
            }
          }
        },
        item: {
          type: "object",
          additionalProperties: false,
          required: ["identifier", "displayName", "maxStackSize"],
          properties: {
            identifier: { type: "string" },
            displayName: { type: "string" },
            maxStackSize: { type: "number" }
          }
        },
        script: {
          type: "object",
          additionalProperties: false,
          required: ["event", "summary", "message"],
          properties: {
            event: { type: "string", enum: ["itemUse", "blockBreak", "interval"] },
            summary: { type: "string" },
            message: { type: "string" }
          }
        },
        unresolvedQuestions: { type: "array", items: { type: "string" } }
      }
    },
    suggestedReplies: { type: "array", maxItems: 4, items: { type: "string" } },
    recommendedReply: { type: "string" }
  }
};

export async function refineAddonSpec(input: ChatInput): Promise<ChatResult> {
  const apiKey = getEnvValue("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY が未設定です。.env または API.env を確認してください。");
  }

  const model = getEnvValue("OPENAI_CHAT_MODEL") || getEnvValue("OPENAI_MODEL") || "gpt-5.4-mini";
  const currentSpec = input.currentSpec ?? emptySpec;

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
                "あなたはMinecraft Bedrock Editionの小規模アドオン作成を支援する設計担当です。",
                "ユーザーの曖昧な希望を、実装可能な仕様へ短く具体化してください。",
                "初期版の対応範囲は recipe, item, script の3種類だけです。",
                "不明点がある場合は unresolvedQuestions に残し、assistantMessage では次に答えてほしいことを1から3個だけ聞いてください。",
                "recipe, item, script は常に全項目を埋めてください。使わない種類の値は空文字、1、空配列など安全な既定値にしてください。",
                "recipe.ingredients は { symbol, item } の配列にしてください。例: [{\"symbol\":\"#\",\"item\":\"minecraft:diamond\"}]",
                "namespace と outputName は英小文字、数字、アンダースコア、ハイフンだけに正規化してください。",
                "BedrockのIDは namespace:name 形式にしてください。",
                "assistantMessage の冒頭で、ユーザーの希望を一度だけ短く言い換えて確認してください（おうむ返し）。冗長な繰り返しはしないでください。",
                "ユーザーが次に答える質問について、選びやすい回答候補を suggestedReplies に2〜4個・各12文字以内で入れてください。最も無難な既定値があれば recommendedReply にその文字列を入れ、無ければ空文字にしてください。自由記述が適切な質問では suggestedReplies を空配列にしてください。"
              ].join("\n")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                currentSpec,
                conversation: input.messages
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "addon_chat_result",
          strict: true,
          schema
        }
      }
    })
  });

  const data = await response.json();
  const outputText = extractOutputText(data);
  const parsed = JSON.parse(outputText) as RawChatResult;
  const suggestedReplies = normalizeSuggestedReplies(parsed.suggestedReplies);
  const recommendedReply = (parsed.recommendedReply ?? "").trim();
  return {
    assistantMessage: parsed.assistantMessage,
    spec: normalizeRawSpec(parsed.spec),
    suggestedReplies,
    recommendedReply: suggestedReplies.includes(recommendedReply) ? recommendedReply : ""
  };
}

export async function generateAddonFilesWithCodex(spec: AddonSpec): Promise<GeneratedAddonFile[]> {
  const apiKey = getEnvValue("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY が未設定です。.env または API.env を確認してください。");
  }

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
                "危険なOS操作、外部通信、eval、Function constructor、ファイルアクセスコードは書かないでください。"
              ].join("\n")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({ spec })
            }
          ]
        }
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
                  properties: {
                    path: { type: "string" },
                    content: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    })
  });

  const data = await response.json();
  const outputText = extractOutputText(data);
  const parsed = JSON.parse(outputText) as { files: GeneratedAddonFile[] };
  return parsed.files;
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
  buildBody
}: OpenAiResponseRequest): Promise<Response> {
  let lastError = "モデル候補が未設定です。";

  for (const model of models) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(buildBody(model))
      });

      if (response.ok) {
        return response;
      }

      const text = await response.text();
      lastError = `${response.status} ${text}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`${errorLabel}: ${lastError}`);
}

function getModelList(primaryModel: string, fallbackEnvName: string): string[] {
  const seen = new Set<string>();
  return [primaryModel, ...getEnvList(fallbackEnvName)].filter((model) => {
    if (!model || seen.has(model)) {
      return false;
    }

    seen.add(model);
    return true;
  });
}

function getEnvList(name: string): string[] {
  return (getEnvValue(name) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeSuggestedReplies(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= 4) break;
  }
  return result;
}

function extractOutputText(data: unknown): string {
  if (typeof data !== "object" || data === null) {
    throw new Error("OpenAI API の応答形式が不正です。");
  }

  const maybeOutputText = (data as { output_text?: unknown }).output_text;
  if (typeof maybeOutputText === "string") return maybeOutputText;

  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    throw new Error("OpenAI API の出力が見つかりません。");
  }

  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }

  throw new Error("OpenAI API のテキスト出力が見つかりません。");
}

function normalizeRawSpec(raw: RawChatResult["spec"]): AddonSpec {
  const recipeKey = Object.fromEntries(
    raw.recipe.ingredients
      .filter((ingredient) => ingredient.symbol.trim() && ingredient.item.trim())
      .map((ingredient) => [ingredient.symbol.trim(), ingredient.item.trim()])
  );

  return {
    title: raw.title,
    description: raw.description,
    kind: raw.kind,
    namespace: raw.namespace,
    outputName: raw.outputName,
    recipe:
      raw.kind === "recipe"
        ? {
            resultItem: raw.recipe.resultItem,
            resultCount: raw.recipe.resultCount,
            pattern: raw.recipe.pattern,
            key: recipeKey
          }
        : undefined,
    item:
      raw.kind === "item"
        ? {
            identifier: raw.item.identifier,
            displayName: raw.item.displayName,
            maxStackSize: raw.item.maxStackSize
          }
        : undefined,
    script:
      raw.kind === "script"
        ? {
            event: raw.script.event,
            summary: raw.script.summary,
            message: raw.script.message
          }
        : undefined,
    unresolvedQuestions: raw.unresolvedQuestions
  };
}
