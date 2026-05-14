import { NextRequest, NextResponse } from "next/server";
import { isDesktopAuthError, verifyDesktopRequest } from "@/lib/desktop-auth";
import { refineAddonSpec } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    verifyDesktopRequest(request);
    const body = await request.json();
    const result = await refineAddonSpec({
      messages: body.messages ?? [],
      currentSpec: body.currentSpec
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: isDesktopAuthError(error) ? 401 : 500 });
  }
}
