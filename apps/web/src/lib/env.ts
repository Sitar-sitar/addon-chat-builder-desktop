import fs from "node:fs";
import path from "node:path";

const CUSTOM_ENV_FILE = "API.env";
const DESKTOP_ENV_FILE = path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "..", ".env");

export function getEnvValue(name: string): string | undefined {
  const existing = process.env[name]?.trim();
  if (existing) return existing;

  const customEnv = readEnvFiles();
  return customEnv[name]?.trim() || undefined;
}

function readEnvFiles(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const envPath of [
    DESKTOP_ENV_FILE,
    path.join(/* turbopackIgnore: true */ process.cwd(), CUSTOM_ENV_FILE),
  ]) {
    if (!fs.existsSync(envPath)) continue;

    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;

      const key = trimmed.slice(0, separator).trim();
      if (values[key]) continue;

      const rawValue = trimmed.slice(separator + 1).trim();
      values[key] = stripQuotes(rawValue);
    }
  }

  return values;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
