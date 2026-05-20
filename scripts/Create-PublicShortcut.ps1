param(
    [ValidateSet("Public", "CurrentUser", "AllUsers")]
    [string]$Scope = "Public",

    [string]$ShortcutName = "Addon Chat Builder.lnk",

    [string]$TargetPath,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Resolve-DefaultTargetPath {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $candidates = @(
        (Join-Path $repoRoot "publish\win-x64\AddonChatBuilder.Desktop.exe"),
        (Join-Path $repoRoot "src\AddonChatBuilder.Desktop\bin\Release\net8.0-windows\win-x64\AddonChatBuilder.Desktop.exe"),
        (Join-Path $repoRoot "src\AddonChatBuilder.Desktop\bin\Debug\net8.0-windows\AddonChatBuilder.Desktop.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw "Executable not found. Publish or build the desktop app first, or pass -TargetPath."
}

function Get-DesktopDirectories {
    param([string]$RequestedScope)

    if ($RequestedScope -eq "Public") {
        return @([Environment]::GetFolderPath("CommonDesktopDirectory"))
    }

    if ($RequestedScope -eq "CurrentUser") {
        return @(Get-CurrentUserDesktopDirectory)
    }

    $userRoot = Join-Path $env:SystemDrive "Users"
    if (-not (Test-Path -LiteralPath $userRoot)) {
        throw "Users directory not found: $userRoot"
    }

    $ignoredProfiles = @("All Users", "Default", "Default User", "Public", "desktop.ini")
    $desktopDirectories = New-Object System.Collections.Generic.List[string]
    foreach ($profile in Get-ChildItem -LiteralPath $userRoot -Directory -Force) {
        if ($ignoredProfiles -contains $profile.Name) {
            continue
        }

        $desktop = Get-ProfileDesktopDirectory -ProfilePath $profile.FullName
        if (-not [string]::IsNullOrWhiteSpace($desktop)) {
            $desktopDirectories.Add($desktop)
        }
    }

    if ($desktopDirectories.Count -eq 0) {
        throw "No user desktop directories were found under $userRoot."
    }

    return $desktopDirectories.ToArray()
}

function Get-CurrentUserDesktopDirectory {
    $knownFolderDesktop = [Environment]::GetFolderPath("DesktopDirectory")
    if (-not [string]::IsNullOrWhiteSpace($knownFolderDesktop) -and (Test-Path -LiteralPath $knownFolderDesktop)) {
        return $knownFolderDesktop
    }

    $profilePath = [Environment]::GetFolderPath("UserProfile")
    $desktop = Get-ProfileDesktopDirectory -ProfilePath $profilePath
    if (-not [string]::IsNullOrWhiteSpace($desktop)) {
        return $desktop
    }

    throw "Current user desktop directory was not found."
}

function Get-ProfileDesktopDirectory {
    param([string]$ProfilePath)

    foreach ($candidate in Get-ProfileDesktopCandidates -ProfilePath $ProfilePath) {
        if (Test-Path -LiteralPath $candidate -ErrorAction SilentlyContinue) {
            return $candidate
        }
    }

    return $null
}

function Get-ProfileDesktopCandidates {
    param([string]$ProfilePath)

    $localizedDesktopName = [string]::Concat([char]0x30C7, [char]0x30B9, [char]0x30AF, [char]0x30C8, [char]0x30C3, [char]0x30D7)
    $candidates = New-Object System.Collections.Generic.List[string]
    Add-UniquePath -Paths $candidates -Path (Join-Path $ProfilePath "OneDrive\Desktop")
    Add-UniquePath -Paths $candidates -Path (Join-Path (Join-Path $ProfilePath "OneDrive") $localizedDesktopName)

    foreach ($oneDriveDirectory in Get-ChildItem -LiteralPath $ProfilePath -Directory -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "OneDrive*" }) {
        Add-UniquePath -Paths $candidates -Path (Join-Path $oneDriveDirectory.FullName "Desktop")
        Add-UniquePath -Paths $candidates -Path (Join-Path $oneDriveDirectory.FullName $localizedDesktopName)
    }

    Add-UniquePath -Paths $candidates -Path (Join-Path $ProfilePath "Desktop")
    Add-UniquePath -Paths $candidates -Path (Join-Path $ProfilePath $localizedDesktopName)
    return $candidates.ToArray()
}

function Add-UniquePath {
    param(
        [System.Collections.Generic.List[string]]$Paths,
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }

    foreach ($existing in $Paths) {
        if ($existing -eq $Path) {
            return
        }
    }

    $Paths.Add($Path)
}

function New-AppShortcut {
    param(
        [string]$ShortcutPath,
        [string]$ExecutablePath,
        [bool]$Overwrite
    )

    if ((Test-Path -LiteralPath $ShortcutPath) -and -not $Overwrite) {
        Write-Host "Skipped existing shortcut: $ShortcutPath"
        return
    }

    $workingDirectory = Split-Path -Parent $ExecutablePath
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $ExecutablePath
    $shortcut.WorkingDirectory = $workingDirectory
    $shortcut.Description = "Addon Chat Builder Desktop"
    $shortcut.IconLocation = "$ExecutablePath,0"
    try {
        $shortcut.Save()
    }
    catch {
        throw "Unable to save shortcut: $ShortcutPath. Run this script as the target user or from an elevated PowerShell session. $($_.Exception.Message)"
    }

    Write-Host "Created shortcut: $ShortcutPath"
}

if ([string]::IsNullOrWhiteSpace($TargetPath)) {
    $TargetPath = Resolve-DefaultTargetPath
}
elseif (Test-Path -LiteralPath $TargetPath) {
    $TargetPath = (Resolve-Path -LiteralPath $TargetPath).Path
}
else {
    throw "Executable not found: $TargetPath"
}

foreach ($desktop in Get-DesktopDirectories -RequestedScope $Scope) {
    $shortcutPath = Join-Path $desktop $ShortcutName
    New-AppShortcut -ShortcutPath $shortcutPath -ExecutablePath $TargetPath -Overwrite $Force.IsPresent
}
