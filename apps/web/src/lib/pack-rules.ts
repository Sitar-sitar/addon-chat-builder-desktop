import { getEnvValue } from "./env";
import type { AddonSpec } from "./spec";

export type PackType = "mcpack" | "datapack" | "resourcepack";

export type GeneratedPackFile = {
  path: string;
  content: string;
};

export const OUTPUT_SUFFIX: Record<PackType, string> = {
  mcpack: ".mcpack",
  datapack: "-datapack.zip",
  resourcepack: "-resourcepack.zip",
};

export const BEDROCK_ALLOWED_PATHS: RegExp[] = [
  /^manifest\.json$/,
  /^README\.txt$/,
  /^recipes\/[a-z0-9_-]+\.json$/,
  /^items\/[a-z0-9_-]+\.json$/,
  /^scripts\/[a-z0-9_-]+\.js$/,
];

export type PackFormat = number | readonly [major: number, minor: number];
export type JavaVersionRule = {
  datapackFormat: PackFormat;
  resourcepackFormat: PackFormat;
  mcmetaFormat: "legacy" | "minMax";
  plainIngredients: boolean;
  itemModelDefinitions: boolean;
  cookingResultCount: boolean;
  timeCheckClock: boolean;
};

export const JAVA_VERSIONS: Record<string, JavaVersionRule> = {
  "1.21": {
    datapackFormat: 48,
    resourcepackFormat: 34,
    mcmetaFormat: "legacy",
    plainIngredients: false,
    itemModelDefinitions: false,
    cookingResultCount: false,
    timeCheckClock: false,
  },
  "1.21.4": {
    datapackFormat: 61,
    resourcepackFormat: 46,
    mcmetaFormat: "legacy",
    plainIngredients: true,
    itemModelDefinitions: true,
    cookingResultCount: false,
    timeCheckClock: false,
  },
  "1.21.5": {
    datapackFormat: 71,
    resourcepackFormat: 55,
    mcmetaFormat: "legacy",
    plainIngredients: true,
    itemModelDefinitions: true,
    cookingResultCount: false,
    timeCheckClock: false,
  },
  "1.21.7": {
    datapackFormat: 81,
    resourcepackFormat: 64,
    mcmetaFormat: "legacy",
    plainIngredients: true,
    itemModelDefinitions: true,
    cookingResultCount: false,
    timeCheckClock: false,
  },
  "26.2": {
    datapackFormat: [107, 1],
    resourcepackFormat: [88, 0],
    mcmetaFormat: "minMax",
    plainIngredients: true,
    itemModelDefinitions: true,
    cookingResultCount: true,
    timeCheckClock: true,
  },
};

export const DEFAULT_JAVA_TARGET_VERSION = "1.21.7";

export function resolvePackType(spec: AddonSpec): PackType {
  if (spec.edition === "bedrock") return "mcpack";
  if (spec.kind === "resourcepack") return "resourcepack";
  return "datapack";
}

export function resolveJavaVersion(versionInput?: string): {
  version: string;
  rule: JavaVersionRule;
} {
  const version =
    versionInput?.trim() ||
    getEnvValue("JAVA_TARGET_VERSION") ||
    DEFAULT_JAVA_TARGET_VERSION;
  const rule = JAVA_VERSIONS[version];
  if (!rule) {
    throw new Error(
      `JAVA_TARGET_VERSION ${version} は未対応です。対応値: ${Object.keys(JAVA_VERSIONS).join(", ")}`,
    );
  }
  return { version, rule };
}

export function isAllowedBedrockPath(filePath: string): boolean {
  return BEDROCK_ALLOWED_PATHS.some((pattern) => pattern.test(filePath));
}
