import { NextResponse } from "next/server";
import { resolveJavaVersion } from "@/lib/pack-rules";

export async function GET() {
  try {
    const { version } = resolveJavaVersion();
    return NextResponse.json({ javaTargetVersion: version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Java版設定の読み込みに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
