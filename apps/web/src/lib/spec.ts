export type AddonKind = "recipe" | "item" | "script";

export type AddonSpec = {
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
  };
  unresolvedQuestions: string[];
};

export const emptySpec: AddonSpec = {
  title: "",
  description: "",
  kind: "recipe",
  namespace: "my_addon",
  outputName: "my-addon",
  unresolvedQuestions: [
    "どんなアドオンにしたいかを入力してください。"
  ]
};

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

export function validateSpec(spec: AddonSpec): string[] {
  const errors: string[] = [];

  if (!spec.title.trim()) errors.push("タイトルが未設定です。");
  if (!spec.description.trim()) errors.push("説明が未設定です。");
  if (!["recipe", "item", "script"].includes(spec.kind)) errors.push("対応していない種類です。");
  if (!/^[a-z][a-z0-9_]*$/.test(spec.namespace)) {
    errors.push("namespace は英小文字、数字、アンダースコアで指定してください。");
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(spec.outputName)) {
    errors.push("出力名は英小文字、数字、ハイフン、アンダースコアで指定してください。");
  }

  if (spec.kind === "recipe") {
    if (!spec.recipe) {
      errors.push("レシピ情報が未設定です。");
    } else {
      if (!spec.recipe.resultItem.includes(":")) errors.push("完成アイテムIDは namespace:item の形にしてください。");
      if (spec.recipe.resultCount < 1 || spec.recipe.resultCount > 64) errors.push("完成数は1から64にしてください。");
      if (spec.recipe.pattern.length < 1 || spec.recipe.pattern.length > 3) errors.push("レシピパターンは1から3行にしてください。");
      if (Object.keys(spec.recipe.key).length < 1) errors.push("レシピ素材が未設定です。");
    }
  }

  if (spec.kind === "item") {
    if (!spec.item) {
      errors.push("アイテム情報が未設定です。");
    } else {
      if (!spec.item.identifier.includes(":")) errors.push("アイテムIDは namespace:item の形にしてください。");
      if (spec.item.maxStackSize < 1 || spec.item.maxStackSize > 64) errors.push("最大スタック数は1から64にしてください。");
    }
  }

  if (spec.kind === "script") {
    if (!spec.script) {
      errors.push("スクリプト情報が未設定です。");
    } else if (!["itemUse", "blockBreak", "interval"].includes(spec.script.event)) {
      errors.push("対応していないイベントです。");
    }
  }

  return errors;
}

