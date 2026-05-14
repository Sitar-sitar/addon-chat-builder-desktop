import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const currentPath = typeof body.currentPath === "string" ? body.currentPath : "";
    const selectedPath = await openFolderDialog(currentPath);

    if (!selectedPath) {
      return NextResponse.json({ canceled: true, path: "" });
    }

    return NextResponse.json({ canceled: false, path: selectedPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "フォルダ選択に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function openFolderDialog(currentPath: string): Promise<string> {
  const escapedCurrentPath = currentPath.replaceAll("'", "''");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'mcpack output folder'",
    "$dialog.ShowNewFolderButton = $true",
    `if ('${escapedCurrentPath}' -and (Test-Path -LiteralPath '${escapedCurrentPath}')) { $dialog.SelectedPath = '${escapedCurrentPath}' }`,
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
  ].join("; ");

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      encoding: "utf8",
      timeout: 120_000,
      windowsHide: false
    }
  );

  return stdout.trim();
}

