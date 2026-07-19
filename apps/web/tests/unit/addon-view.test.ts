import { describe, expect, it } from "vitest";
import {
  blueprintRows,
  kindLabel,
  stepState,
} from "../../src/utils/addon-view";
import { JAVA_VERSIONS } from "../../src/lib/pack-rules";
import { caps, javaScriptSpec, javaSpec } from "./java-fixtures";

describe("addon view", () => {
  it("labels all Java kinds", () =>
    expect(kindLabel("loot")).toBe("ドロップ差し替え"));
  it("shows Java trigger, condition, actions and blockers", () => {
    const spec = javaScriptSpec({ condition: "night" });
    spec.unsupportedRequests = ["未対応: 新モブ追加"];
    spec.unresolvedQuestions = ["対象を確認"];
    const rows = blueprintRows(spec, "1.21.7", caps(), JAVA_VERSIONS["1.21.7"]);
    expect(rows.map((r) => r.label)).toEqual(
      expect.arrayContaining([
        "トリガー",
        "条件",
        "アクション",
        "未対応の要望",
        "未解決の質問",
      ]),
    );
  });
  it("keeps step state and valid recipe blueprint", () => {
    expect(
      stepState({ hasStarted: true, canBuild: true, built: false }).build,
    ).toBe("current");
    expect(
      blueprintRows(javaSpec(), "1.21.7", caps(), JAVA_VERSIONS["1.21.7"]).some(
        (r) => r.status === "current",
      ),
    ).toBe(false);
  });
});
