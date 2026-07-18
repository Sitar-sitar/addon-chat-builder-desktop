import { NextRequest, NextResponse } from "next/server";
import { isDesktopAuthError, verifyDesktopRequest } from "@/lib/desktop-auth";
import { refineAddonSpec } from "@/lib/openai";
import type { Edition } from "@/lib/spec";

export async function POST(request: NextRequest) {
  try {
    verifyDesktopRequest(request);
    const body = await request.json();
    if (body.edition !== "bedrock" && body.edition !== "java") {
      return NextResponse.json({ error: "edition は bedrock または java を指定してください。" }, { status: 400 });
    }
    const edition: Edition = body.edition;
    const result = await refineAddonSpec({
      messages: body.messages ?? [],
      edition,
      currentSpec: body.currentSpec
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: isDesktopAuthError(error) ? 401 : 500 });
  }
}
