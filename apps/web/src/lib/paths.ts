import path from "node:path";
import { getEnvValue } from "./env";
import type { Edition } from "./spec";

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "mcpack");
const DEFAULT_OUTPUT_DIR_JAVA = path.join(process.cwd(), "javapack");

export function getDefaultOutputDir(edition: Edition = "bedrock"): string {
  if (edition === "java") {
    return getEnvValue("DEFAULT_OUTPUT_DIR_JAVA") || DEFAULT_OUTPUT_DIR_JAVA;
  }
  return getEnvValue("DEFAULT_OUTPUT_DIR") || DEFAULT_OUTPUT_DIR;
}

export function resolveOutputDir(input: string, edition: Edition = "bedrock"): string {
  const selected = input.trim() || getDefaultOutputDir(edition);
  return path.resolve(/* turbopackIgnore: true */ selected);
}

export function isSafeOutputDir(outputDir: string): boolean {
  const resolved = path.resolve(/* turbopackIgnore: true */ outputDir);
  const root = path.parse(resolved).root;
  return resolved.length > root.length + 2;
}
