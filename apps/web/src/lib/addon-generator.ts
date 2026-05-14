import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { AddonSpec, validateSpec } from "./spec";
import { isSafeOutputDir, resolveOutputDir } from "./paths";
import { GeneratedAddonFile, generateAddonFilesWithCodex } from "./openai";

type BuildResult = {
  mcpackPath: string;
  files: string[];
};

export async function buildMcpack(spec: AddonSpec, outputDirInput: string): Promise<BuildResult> {
  const errors = validateSpec(spec);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const outputDir = resolveOutputDir(outputDirInput);
  if (!isSafeOutputDir(outputDir)) {
    throw new Error("出力先フォルダが不正です。");
  }

  await fs.mkdir(outputDir, { recursive: true });

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "addon-chat-builder-"));

  try {
    const packDir = path.join(tempRoot, "pack");
    await fs.mkdir(packDir, { recursive: true });

    const generatedFiles = await generateAddonFilesWithCodex(spec);
    const files = await writeGeneratedFiles(packDir, generatedFiles);
    const mcpackPath = path.join(outputDir, `${spec.outputName}.mcpack`);
    const zip = new AdmZip();
    zip.addLocalFolder(packDir);
    zip.writeZip(mcpackPath);

    return { mcpackPath, files };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function writeGeneratedFiles(packDir: string, generatedFiles: GeneratedAddonFile[]): Promise<string[]> {
  validateGeneratedFiles(generatedFiles);
  const files: string[] = [];

  for (const file of generatedFiles) {
    await writeFile(packDir, file.path, file.content);
    files.push(file.path.replaceAll("\\", "/"));
  }

  return files;
}

function validateGeneratedFiles(files: GeneratedAddonFile[]): void {
  if (!files.some((file) => file.path === "manifest.json")) {
    throw new Error("Codex生成結果に manifest.json が含まれていません。");
  }

  for (const file of files) {
    const normalized = file.path.replaceAll("\\", "/");
    if (path.isAbsolute(file.path) || normalized.includes("../") || normalized.startsWith("/")) {
      throw new Error(`不正なファイルパスです: ${file.path}`);
    }
    if (!isAllowedPackPath(normalized)) {
      throw new Error(`許可されていないファイルパスです: ${file.path}`);
    }
    if (file.content.length > 80_000) {
      throw new Error(`ファイルサイズが大きすぎます: ${file.path}`);
    }
    if (normalized.endsWith(".json")) {
      try {
        JSON.parse(file.content);
      } catch {
        throw new Error(`JSONとして解析できません: ${file.path}`);
      }
    }
    if (normalized.endsWith(".js") && hasUnsafeScriptContent(file.content)) {
      throw new Error(`安全でない可能性があるスクリプトを検出しました: ${file.path}`);
    }
  }
}

function isAllowedPackPath(filePath: string): boolean {
  if (filePath === "manifest.json" || filePath === "README.txt") return true;
  return (
    /^recipes\/[a-z0-9_-]+\.json$/.test(filePath) ||
    /^items\/[a-z0-9_-]+\.json$/.test(filePath) ||
    /^scripts\/[a-z0-9_-]+\.js$/.test(filePath)
  );
}

function hasUnsafeScriptContent(content: string): boolean {
  const unsafePatterns = [
    "eval(",
    "Function(",
    "fetch(",
    "XMLHttpRequest",
    "import(",
    "require(",
    "fs.",
    "child_process",
    "process."
  ];
  return unsafePatterns.some((pattern) => content.includes(pattern));
}

async function writeFile(root: string, relativePath: string, content: string): Promise<void> {
  const targetPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}
