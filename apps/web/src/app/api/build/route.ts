import { NextRequest, NextResponse } from "next/server";
import { buildPack } from "@/lib/addon-generator";
import { isDesktopAuthError, verifyDesktopRequest } from "@/lib/desktop-auth";

export async function POST(request: NextRequest) {
  try {
    verifyDesktopRequest(request);
    const body = await request.json();
    const result = await buildPack(body.spec, body.outputDir ?? "");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: isDesktopAuthError(error) ? 401 : 400 });
  }
}
