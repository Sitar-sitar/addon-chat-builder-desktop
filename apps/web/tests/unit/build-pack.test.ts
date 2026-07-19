import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import { buildPack } from "../../src/lib/addon-generator";
import { javaScriptSpec, javaSpec, shapedRecipe } from "./java-fixtures";

const dirs: string[] = [];
const original = process.env.JAVA_TARGET_VERSION;
afterEach(async () => {
  if (original === undefined) delete process.env.JAVA_TARGET_VERSION;
  else process.env.JAVA_TARGET_VERSION = original;
  await Promise.all(
    dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })),
  );
});
async function output() {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "addon-pack-output-"));
  dirs.push(d);
  return d;
}

describe("buildPack", () => {
  it("writes a validated zip with the server description", async () => {
    process.env.JAVA_TARGET_VERSION = "1.21.5";
    const out = await output();
    const result = await buildPack(javaSpec(), out);
    expect(path.basename(result.packPath)).toBe("test-pack-datapack.zip");
    expect(result.description).toContain("Java 1.21.5");
    const zip = new AdmZip(result.packPath);
    expect(
      zip
        .getEntries()
        .filter((e) => !e.isDirectory)
        .map((e) => e.entryName)
        .sort(),
    ).toEqual([...result.files].sort());
    expect(JSON.parse(zip.readAsText("pack.mcmeta")).pack.description).toBe(
      result.description,
    );
    expect(zip.readAsText("README.txt")).toContain(result.description);
  });
  it("rejects unresolved and unsupported Java requests before output", async () => {
    process.env.JAVA_TARGET_VERSION = "1.21.7";
    const out = await output();
    const unresolved = javaSpec({ unresolvedQuestions: ["確認待ち"] });
    await expect(buildPack(unresolved, out)).rejects.toThrow("確認待ち");
    await expect(
      buildPack(javaSpec({ unsupportedRequests: ["未対応: 新モブ"] }), out),
    ).rejects.toThrow("未対応: 新モブ");
    expect(await fs.readdir(out)).toEqual([]);
  });
  it("rejects shaped recipes with unused key symbols before writing output", async () => {
    process.env.JAVA_TARGET_VERSION = "1.21.7";
    const out = await output();
    const spec = javaSpec({
      recipe: {
        ...shapedRecipe(),
        key: { ...shapedRecipe().key, B: "minecraft:iron_ingot" },
      },
    });
    await expect(buildPack(spec, out)).rejects.toThrow(
      "パターンで使われていない記号",
    );
    expect(await fs.readdir(out)).toEqual([]);
  });
  it("rejects unknown versions and invalid scripts", async () => {
    const out = await output();
    process.env.JAVA_TARGET_VERSION = "1.21.999";
    await expect(buildPack(javaSpec(), out)).rejects.toThrow("未対応");
    process.env.JAVA_TARGET_VERSION = "1.21.7";
    await expect(
      buildPack(javaScriptSpec({ actions: [] }), out),
    ).rejects.toThrow("アクション");
  });
});
