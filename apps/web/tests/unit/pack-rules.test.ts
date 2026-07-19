import { describe, expect, it } from "vitest";
import {
  JAVA_VERSIONS,
  resolveJavaVersion,
  resolvePackType,
} from "../../src/lib/pack-rules";
import { javaSpec } from "./java-fixtures";

describe("pack rules", () => {
  it("keeps legacy formats and adds 26.2 min/max formats", () => {
    expect(JAVA_VERSIONS["1.21.7"].datapackFormat).toBe(81);
    expect(JAVA_VERSIONS["26.2"]).toMatchObject({
      datapackFormat: [107, 1],
      resourcepackFormat: [88, 0],
      mcmetaFormat: "minMax",
      timeCheckClock: true,
    });
  });
  it("rejects unknown versions", () =>
    expect(() => resolveJavaVersion("9.9")).toThrow("未対応"));
  it("resolves loot as datapack and resourcepack as resourcepack", () => {
    expect(
      resolvePackType(
        javaSpec({
          kind: "loot",
          recipe: undefined,
          loot: {
            targetBlockId: "minecraft:stone",
            dropItemId: "minecraft:gold_ingot",
            dropCount: 1,
          },
        }),
      ),
    ).toBe("datapack");
    expect(
      resolvePackType(
        javaSpec({
          kind: "resourcepack",
          recipe: undefined,
          resourcepack: {
            pattern: "lang",
            langEntries: [{ key: "item.minecraft.apple", value: "りんご" }],
            targetItem: "",
            sourceItem: "",
          },
        }),
      ),
    ).toBe("resourcepack");
  });
});
