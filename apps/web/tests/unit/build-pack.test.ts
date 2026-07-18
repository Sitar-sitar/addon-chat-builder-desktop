import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import { buildPack } from "@/lib/addon-generator";
import type { AddonSpec } from "@/lib/spec";

const tempDirs: string[] = [];
const originalVersion = process.env.JAVA_TARGET_VERSION;

afterEach(async () => {
  if (originalVersion === undefined) delete process.env.JAVA_TARGET_VERSION;
  else process.env.JAVA_TARGET_VERSION = originalVersion;
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("buildPack Java版", () => {
  it("検証済みファイルをdatapack zipとして書き出す", async () => {
    process.env.JAVA_TARGET_VERSION = "1.21.5";
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "addon-pack-output-"));
    tempDirs.push(outputDir);
    const spec: AddonSpec = {
      edition: "java",
      title: "棒レシピ",
      description: "ダイヤから棒を作る",
      kind: "recipe",
      namespace: "sample",
      outputName: "diamond-stick",
      recipe: {
        resultItem: "minecraft:stick",
        resultCount: 2,
        pattern: ["#"],
        key: { "#": "minecraft:diamond" }
      },
      unresolvedQuestions: []
    };

    const result = await buildPack(spec, outputDir);

    expect(path.basename(result.packPath)).toBe("diamond-stick-datapack.zip");
    expect(result.files).toEqual([
      "pack.mcmeta",
      "README.txt",
      "data/sample/recipe/diamond-stick.json"
    ]);
    const zip = new AdmZip(result.packPath);
    const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
    expect(entries.map((entry) => entry.entryName).sort()).toEqual([...result.files].sort());
    expect(JSON.parse(zip.readAsText("pack.mcmeta")).pack.pack_format).toBe(71);
  });

  it("未知の対象バージョンではzipを作らない", async () => {
    process.env.JAVA_TARGET_VERSION = "1.21.999";
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "addon-pack-output-"));
    tempDirs.push(outputDir);
    const spec: AddonSpec = {
      edition: "java",
      title: "通知",
      description: "定期通知",
      kind: "script",
      namespace: "notify",
      outputName: "notify",
      script: { event: "interval", summary: "通知", message: "休憩", intervalSeconds: 60 },
      unresolvedQuestions: []
    };

    await expect(buildPack(spec, outputDir)).rejects.toThrow("1.21.999 は未対応です");
    expect(await fs.readdir(outputDir)).toEqual([]);
  });
});
