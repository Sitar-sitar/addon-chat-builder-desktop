import { NextRequest } from "next/server";

class DesktopAuthError extends Error {
  constructor() {
    super("デスクトップアプリからのリクエストとして確認できませんでした。");
    this.name = "DesktopAuthError";
  }
}

export function verifyDesktopRequest(request: NextRequest): void {
  const expectedToken = process.env.DESKTOP_API_TOKEN;
  if (!expectedToken) return;

  const actualToken = request.headers.get("x-desktop-token");
  if (actualToken !== expectedToken) {
    throw new DesktopAuthError();
  }
}

export function isDesktopAuthError(error: unknown): boolean {
  return error instanceof DesktopAuthError;
}
