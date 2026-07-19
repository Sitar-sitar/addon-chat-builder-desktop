import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { describePack, generateJavaFiles } from "./java-generator";
import { enabledJavaCapabilities } from "./pattern-catalog";
import {
  isAllowedBedrockPath,
  OUTPUT_SUFFIX,
  resolvePackType,
  resolveJavaVersion,
} from "./pack-rules";
import type { GeneratedPackFile } from "./pack-rules";
import { isSafeOutputDir, resolveOutputDir } from "./paths";
import { AddonSpec, validateSpec, type BedrockAddonSpec } from "./spec";
import { generateAddonFilesWithCodex } from "./openai";

export type BuildResult = {
  packPath: string;
  files: string[];
  description: string;
};

export async function buildPack(
  spec: AddonSpec,
  outputDirInput: string,
): Promise<BuildResult> {
  const resolved = spec.edition === "java" ? resolveJavaVersion() : undefined;
  const capabilities = resolved
    ? enabledJavaCapabilities(resolved.rule).map((capability) => capability.id)
    : [];
  const errors = validateSpec(spec, capabilities, resolved?.rule);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  if (
    spec.edition === "java" &&
    (spec.unresolvedQuestions.length > 0 || spec.unsupportedRequests.length > 0)
  ) {
    throw new Error(
      [...spec.unresolvedQuestions, ...spec.unsupportedRequests].join("\n"),
    );
  }

  const outputDir = resolveOutputDir(outputDirInput, spec.edition);
  if (!isSafeOutputDir(outputDir)) {
    throw new Error("出力先フォルダが不正です。");
  }

  await fs.mkdir(outputDir, { recursive: true });
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "addon-chat-builder-"),
  );

  try {
    const packDir = path.join(tempRoot, "pack");
    await fs.mkdir(packDir, { recursive: true });

    const generatedFiles =
      spec.edition === "java"
        ? generateJavaFiles(spec, resolved?.version)
        : await generateAddonFilesWithCodex(spec as BedrockAddonSpec);
    const files = await writeGeneratedFiles(
      packDir,
      generatedFiles,
      spec.edition === "bedrock",
    );
    const packType = resolvePackType(spec);
    const packPath = path.join(
      outputDir,
      `${spec.outputName}${OUTPUT_SUFFIX[packType]}`,
    );
    const zip = new AdmZip();
    zip.addLocalFolder(packDir);
    zip.writeZip(packPath);

    return {
      packPath,
      files,
      description:
        spec.edition === "java"
          ? describePack(spec, resolved!.version)
          : spec.description,
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function writeGeneratedFiles(
  packDir: string,
  generatedFiles: GeneratedPackFile[],
  enforceBedrockRules: boolean,
): Promise<string[]> {
  validateGeneratedFiles(generatedFiles, enforceBedrockRules);
  const files: string[] = [];

  for (const file of generatedFiles) {
    await writeFile(packDir, file.path, file.content);
    files.push(file.path.replaceAll("\\", "/"));
  }

  return files;
}

function validateGeneratedFiles(
  files: GeneratedPackFile[],
  enforceBedrockRules: boolean,
): void {
  const normalizedPaths = new Set<string>();
  if (
    enforceBedrockRules &&
    !files.some((file) => file.path === "manifest.json")
  ) {
    throw new Error("Codex生成結果に manifest.json が含まれていません。");
  }

  for (const file of files) {
    const normalized = file.path.replaceAll("\\", "/");
    if (
      path.isAbsolute(file.path) ||
      normalized.includes("../") ||
      normalized.startsWith("/")
    ) {
      throw new Error(`不正なファイルパスです: ${file.path}`);
    }
    if (normalizedPaths.has(normalized)) {
      throw new Error(`ファイルパスが重複しています: ${file.path}`);
    }
    normalizedPaths.add(normalized);
    if (enforceBedrockRules && !isAllowedBedrockPath(normalized)) {
      throw new Error(`許可されていないファイルパスです: ${file.path}`);
    }
    if (file.content.length > 80_000) {
      throw new Error(`ファイルサイズが大きすぎます: ${file.path}`);
    }
    if (normalized.endsWith(".json") || normalized === "pack.mcmeta") {
      try {
        JSON.parse(file.content);
      } catch {
        throw new Error(`JSONとして解析できません: ${file.path}`);
      }
    }
    if (
      enforceBedrockRules &&
      normalized.endsWith(".js") &&
      hasUnsafeScriptContent(file.content)
    ) {
      throw new Error(
        `安全でない可能性があるスクリプトを検出しました: ${file.path}`,
      );
    }
  }
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
    "process.",
  ];
  return unsafePatterns.some((pattern) => content.includes(pattern));
}

async function writeFile(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const targetPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}
