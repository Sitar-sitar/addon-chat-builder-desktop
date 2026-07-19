import { NextResponse } from "next/server";
import { resolveJavaVersion } from "@/lib/pack-rules";
import { enabledJavaCapabilities } from "@/lib/pattern-catalog";

export async function GET() {
  try {
    const { version, rule } = resolveJavaVersion();
    return NextResponse.json({
      javaTargetVersion: version,
      javaCapabilities: enabledJavaCapabilities(rule).map(
        (capability) => capability.id,
      ),
      javaVersionRule: rule,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Java版設定の読み込みに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
