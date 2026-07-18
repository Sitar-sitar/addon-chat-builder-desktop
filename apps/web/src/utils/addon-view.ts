import { AddonKind, AddonSpec, SpecCheck, specChecks } from "@/lib/spec";

export function kindLabel(kind: AddonKind): string {
  switch (kind) {
    case "recipe":
      return "レシピ";
    case "item":
      return "アイテム";
    case "script":
      return "スクリプト";
    case "resourcepack":
      return "リソースパック";
  }
}

export type StepStatus = "done" | "current" | "todo";
export type StepView = { kind: StepStatus; detail: StepStatus; build: StepStatus };

export function stepState(input: { hasStarted: boolean; canBuild: boolean; built: boolean }): StepView {
  const { hasStarted, canBuild, built } = input;
  if (!hasStarted) return { kind: "current", detail: "todo", build: "todo" };
  if (!canBuild) return { kind: "done", detail: "current", build: "todo" };
  if (!built) return { kind: "done", detail: "done", build: "current" };
  return { kind: "done", detail: "done", build: "done" };
}

export type RowStatus = "done" | "current" | "pending" | "info";
export type BlueprintRow = { label: string; value: string; status: RowStatus };

export function blueprintRows(spec: AddonSpec, javaTargetVersion = ""): BlueprintRow[] {
  const checks = specChecks(spec);

  let currentAssigned = false;
  const statusByKey = new Map<string, RowStatus>();
  for (const c of checks) {
    if (c.ok) {
      statusByKey.set(c.key, "done");
    } else if (!currentAssigned) {
      statusByKey.set(c.key, "current");
      currentAssigned = true;
    } else {
      statusByKey.set(c.key, "pending");
    }
  }

  const toRow = (c: SpecCheck): BlueprintRow => ({
    label: c.label,
    value: c.key === "kind" ? kindLabel(spec.kind) : c.value || "未定",
    status: statusByKey.get(c.key) ?? "pending"
  });

  const rows: BlueprintRow[] = [
    {
      label: "エディション",
      value:
        spec.edition === "java"
          ? `Java版${javaTargetVersion ? `（${javaTargetVersion}）` : ""}`
          : "統合版",
      status: "info"
    }
  ];
  if (spec.edition === "java") {
    rows.push({
      label: "パック種別",
      value: spec.kind === "resourcepack" ? "リソースパック" : "データパック",
      status: "info"
    });
  }
  rows.push(...checks.map(toRow));

  const insertInfoAfter = (afterKey: string, row: BlueprintRow) => {
    const index = checks.findIndex((c) => c.key === afterKey);
    const infoOffset = rows.length - checks.length;
    if (index >= 0) rows.splice(infoOffset + index + 1, 0, row);
    else rows.push(row);
  };

  // 非ブロッキングの情報行（生成可否には影響しない）。
  if (spec.kind === "item") {
    insertInfoAfter("identifier", {
      label: "表示名",
      value: spec.item?.displayName.trim() || "未設定",
      status: "info"
    });
  } else if (spec.kind === "script") {
    insertInfoAfter("event", {
      label: "概要",
      value: spec.script?.summary.trim() || "未設定",
      status: "info"
    });
  }

  return rows;
}
