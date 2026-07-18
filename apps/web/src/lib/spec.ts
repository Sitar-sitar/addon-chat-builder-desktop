export type Edition = "bedrock" | "java";
export type AddonKind = "recipe" | "item" | "script" | "resourcepack";

export type AddonSpec = {
  edition: Edition;
  title: string;
  description: string;
  kind: AddonKind;
  namespace: string;
  outputName: string;
  recipe?: {
    resultItem: string;
    resultCount: number;
    pattern: string[];
    key: Record<string, string>;
  };
  item?: {
    identifier: string;
    displayName: string;
    maxStackSize: number;
  };
  script?: {
    event: "itemUse" | "blockBreak" | "interval";
    summary: string;
    message: string;
    intervalSeconds?: number;
  };
  resourcepack?: {
    langEntries: { key: string; value: string }[];
  };
  unresolvedQuestions: string[];
};

export function createEmptySpec(edition: Edition = "bedrock"): AddonSpec {
  return {
    edition,
    title: "",
    description: "",
    kind: "recipe",
    namespace: "my_addon",
    outputName: "my-addon",
    unresolvedQuestions: ["どんなアドオンにしたいかを入力してください。"]
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

const editions: Edition[] = ["bedrock", "java"];
const kinds: AddonKind[] = ["recipe", "item", "script", "resourcepack"];
const scriptEvents = ["itemUse", "blockBreak", "interval"] as const;
const langKeyPattern = /^(item|block)\.minecraft\.[a-z0-9_]+$/;

export function validateSpec(spec: AddonSpec): string[] {
  const errors: string[] = [];
  const validEdition = editions.includes(spec.edition);
  const validKind = kinds.includes(spec.kind);

  if (!spec.title.trim()) errors.push("タイトルが未設定です。");
  if (!spec.description.trim()) errors.push("説明が未設定です。");
  if (!validEdition) errors.push("対応していないエディションです。");
  if (!validKind) errors.push("対応していない種類です。");
  if (validEdition && validKind && !isEditionKindCompatible(spec.edition, spec.kind)) {
    errors.push(editionKindError(spec.edition, spec.kind));
  }
  if (!/^[a-z][a-z0-9_]*$/.test(spec.namespace)) {
    errors.push("namespace は英小文字、数字、アンダースコアで指定してください。");
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(spec.outputName)) {
    errors.push("出力名は英小文字、数字、ハイフン、アンダースコアで指定してください。");
  }

  if (spec.kind === "recipe") validateRecipe(spec, errors);
  if (spec.kind === "item") validateItem(spec, errors);
  if (spec.kind === "script") validateScript(spec, errors);
  if (spec.kind === "resourcepack") validateResourcepack(spec, errors);

  return errors;
}

function validateRecipe(spec: AddonSpec, errors: string[]): void {
  if (!spec.recipe) {
    errors.push("レシピ情報が未設定です。");
    return;
  }

  if (!spec.recipe.resultItem.includes(":")) {
    errors.push("完成アイテムIDは namespace:item の形にしてください。");
  }
  if (spec.recipe.resultCount < 1 || spec.recipe.resultCount > 64) {
    errors.push("完成数は1から64にしてください。");
  }
  if (spec.recipe.pattern.length < 1 || spec.recipe.pattern.length > 3) {
    errors.push("レシピパターンは1から3行にしてください。");
  }
  if (Object.keys(spec.recipe.key).length < 1) {
    errors.push("レシピ素材が未設定です。");
  }

  if (spec.edition === "java") {
    if (!spec.recipe.resultItem.startsWith("minecraft:")) {
      errors.push("Java版の完成アイテムは minecraft: のバニラIDにしてください。");
    }
    if (Object.values(spec.recipe.key).some((item) => !item.startsWith("minecraft:"))) {
      errors.push("Java版のレシピ素材は minecraft: のバニラIDにしてください。");
    }
  }
}

function validateItem(spec: AddonSpec, errors: string[]): void {
  if (!spec.item) {
    errors.push("アイテム情報が未設定です。");
    return;
  }
  if (!spec.item.identifier.includes(":")) {
    errors.push("アイテムIDは namespace:item の形にしてください。");
  }
  if (spec.item.maxStackSize < 1 || spec.item.maxStackSize > 64) {
    errors.push("最大スタック数は1から64にしてください。");
  }
}

function validateScript(spec: AddonSpec, errors: string[]): void {
  if (!spec.script) {
    errors.push("スクリプト情報が未設定です。");
    return;
  }
  if (!scriptEvents.includes(spec.script.event)) {
    errors.push("対応していないイベントです。");
  }
  if (spec.edition !== "java") return;

  if (spec.script.event !== "interval") {
    errors.push("Java版の script は interval のみ対応です。");
  }
  if (
    !Number.isInteger(spec.script.intervalSeconds) ||
    (spec.script.intervalSeconds ?? 0) < 5 ||
    (spec.script.intervalSeconds ?? 0) > 3600
  ) {
    errors.push("Java版の通知間隔は5秒から3600秒にしてください。");
  }
}

function validateResourcepack(spec: AddonSpec, errors: string[]): void {
  const entries = spec.resourcepack?.langEntries ?? [];
  if (entries.length < 1) {
    errors.push("表示名の変更内容が未設定です。");
    return;
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (!langKeyPattern.test(entry.key)) {
      errors.push("lang のキーは item.minecraft.* または block.minecraft.* の形にしてください。");
    }
    if (!entry.value.trim()) {
      errors.push("lang の表示名は空にできません。");
    }
    if (seen.has(entry.key)) {
      errors.push(`lang のキーが重複しています: ${entry.key}`);
    }
    seen.add(entry.key);
  }
}

function isEditionKindCompatible(edition: Edition, kind: AddonKind): boolean {
  if (edition === "bedrock") return kind !== "resourcepack";
  return kind !== "item";
}

function editionKindError(edition: Edition, kind: AddonKind): string {
  if (edition === "java" && kind === "item") {
    return "Java版ではアイテム追加はデータパックで実現できません（Mod が必要です）。";
  }
  return "リソースパックは Java版のみ対応です。";
}

// blueprintRows と canBuild の完了判定を一致させる行レベル述語。
// 不変条件: specChecks(spec).every(c => c.ok) === (validateSpec(spec).length === 0)
export type SpecCheck = {
  key: string;
  label: string;
  value: string;
  ok: boolean;
};

export function specChecks(spec: AddonSpec): SpecCheck[] {
  const validEdition = editions.includes(spec.edition);
  const validKind = kinds.includes(spec.kind);
  const checks: SpecCheck[] = [
    {
      key: "kind",
      label: "種類",
      value: spec.kind,
      ok: validEdition && validKind && isEditionKindCompatible(spec.edition, spec.kind)
    },
    { key: "title", label: "名前", value: spec.title.trim(), ok: !!spec.title.trim() },
    { key: "description", label: "説明", value: spec.description.trim(), ok: !!spec.description.trim() }
  ];

  if (spec.kind === "recipe") {
    const recipe = spec.recipe;
    checks.push(
      {
        key: "resultItem",
        label: "完成品",
        value: recipe?.resultItem ?? "",
        ok:
          !!recipe &&
          recipe.resultItem.includes(":") &&
          (spec.edition !== "java" || recipe.resultItem.startsWith("minecraft:"))
      },
      {
        key: "resultCount",
        label: "個数",
        value: recipe ? String(recipe.resultCount) : "",
        ok: !!recipe && recipe.resultCount >= 1 && recipe.resultCount <= 64
      },
      {
        key: "pattern",
        label: "形",
        value: recipe ? recipe.pattern.join(" / ") : "",
        ok: !!recipe && recipe.pattern.length >= 1 && recipe.pattern.length <= 3
      },
      {
        key: "key",
        label: "素材",
        value: recipe ? `${Object.keys(recipe.key).length}種` : "",
        ok:
          !!recipe &&
          Object.keys(recipe.key).length >= 1 &&
          (spec.edition !== "java" || Object.values(recipe.key).every((item) => item.startsWith("minecraft:")))
      }
    );
  } else if (spec.kind === "item") {
    const item = spec.item;
    checks.push(
      { key: "identifier", label: "ID", value: item?.identifier ?? "", ok: !!item && item.identifier.includes(":") },
      {
        key: "maxStackSize",
        label: "最大スタック",
        value: item ? String(item.maxStackSize) : "",
        ok: !!item && item.maxStackSize >= 1 && item.maxStackSize <= 64
      }
    );
  } else if (spec.kind === "script") {
    const script = spec.script;
    checks.push({
      key: "event",
      label: "イベント",
      value: script?.event ?? "",
      ok:
        !!script &&
        scriptEvents.includes(script.event) &&
        (spec.edition !== "java" || script.event === "interval")
    });
    if (spec.edition === "java") {
      checks.push({
        key: "intervalSeconds",
        label: "間隔",
        value: script?.intervalSeconds ? `${script.intervalSeconds}秒` : "",
        ok:
          !!script &&
          Number.isInteger(script.intervalSeconds) &&
          (script.intervalSeconds ?? 0) >= 5 &&
          (script.intervalSeconds ?? 0) <= 3600
      });
    }
  } else if (spec.kind === "resourcepack") {
    const entries = spec.resourcepack?.langEntries ?? [];
    const uniqueKeys = new Set(entries.map((entry) => entry.key));
    checks.push({
      key: "langEntries",
      label: "表示名の変更",
      value: entries.length > 0 ? `${entries.length}件` : "",
      ok:
        entries.length > 0 &&
        uniqueKeys.size === entries.length &&
        entries.every((entry) => langKeyPattern.test(entry.key) && !!entry.value.trim())
    });
  }

  checks.push(
    { key: "namespace", label: "namespace", value: spec.namespace, ok: /^[a-z][a-z0-9_]*$/.test(spec.namespace) },
    {
      key: "outputName",
      label: "出力名",
      value: spec.outputName,
      ok: /^[a-z0-9][a-z0-9_-]*$/.test(spec.outputName)
    }
  );

  return checks;
}
