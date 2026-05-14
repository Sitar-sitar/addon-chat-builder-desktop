param(
    [string]$ShortcutName = "Addon Chat Builder.lnk"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $repoRoot "publish\win-x64\AddonChatBuilder.Desktop.exe"

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Executable not found: $targetPath"
}

$publicDesktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
$shortcutPath = Join-Path $publicDesktop $ShortcutName
$workingDirectory = Split-Path -Parent $targetPath

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $workingDirectory
$shortcut.Description = "Addon Chat Builder Desktop"
$shortcut.IconLocation = "$targetPath,0"
$shortcut.Save()

Write-Host "Created shortcut: $shortcutPath"
