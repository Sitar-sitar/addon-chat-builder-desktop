import { afterEach, describe, expect, it, vi } from "vitest";
import { JAVA_VERSIONS, OUTPUT_SUFFIX, resolveJavaVersion, resolvePackType } from "@/lib/pack-rules";
import type { AddonSpec } from "@/lib/spec";

vi.mock("@/lib/env", () => ({
  getEnvValue: (name: string) => process.env[name]?.trim() || undefined
}));

const originalVersion = process.env.JAVA_TARGET_VERSION;

afterEach(() => {
  if (originalVersion === undefined) delete process.env.JAVA_TARGET_VERSION;
  else process.env.JAVA_TARGET_VERSION = originalVersion;
});

describe("Java version rules", () => {
  it("既定1.21.7と実機1.21.5を解決する", () => {
    delete process.env.JAVA_TARGET_VERSION;
    expect(resolveJavaVersion().version).toBe("1.21.7");
    expect(resolveJavaVersion("1.21.5")).toEqual({ version: "1.21.5", rule: JAVA_VERSIONS["1.21.5"] });
  });

  it("環境変数と未知版拒否を処理する", () => {
    process.env.JAVA_TARGET_VERSION = "1.21.4";
    expect(resolveJavaVersion().version).toBe("1.21.4");
    expect(() => resolveJavaVersion("1.21.9")).toThrow("未対応");
  });
});

describe("pack type", () => {
  const base: AddonSpec = {
    edition: "bedrock",
    title: "x",
    description: "x",
    kind: "recipe",
    namespace: "x",
    outputName: "x",
    unresolvedQuestions: []
  };

  it("種別とsuffixを対応付ける", () => {
    expect(resolvePackType(base)).toBe("mcpack");
    expect(resolvePackType({ ...base, edition: "java" })).toBe("datapack");
    expect(resolvePackType({ ...base, edition: "java", kind: "resourcepack" })).toBe("resourcepack");
    expect(OUTPUT_SUFFIX).toEqual({ mcpack: ".mcpack", datapack: "-datapack.zip", resourcepack: "-resourcepack.zip" });
  });
});
