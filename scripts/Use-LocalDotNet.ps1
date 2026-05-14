param(
    [switch]$PrintOnly
)

$ErrorActionPreference = "Stop"

$dotnetRoot = "C:\Program Files\dotnet"
$dotnetExe = Join-Path $dotnetRoot "dotnet.exe"

if (-not (Test-Path -LiteralPath $dotnetExe)) {
    throw ".NET SDK was not found: $dotnetExe"
}

if ($PrintOnly) {
    Write-Output $dotnetExe
    return
}

$env:DOTNET_ROOT = $dotnetRoot
$env:DOTNET_MULTILEVEL_LOOKUP = "0"

$pathParts = $env:Path -split ";"
$hasDotnetRoot = $false
foreach ($pathPart in $pathParts) {
    if ($pathPart -eq $dotnetRoot) {
        $hasDotnetRoot = $true
        break
    }
}

if (-not $hasDotnetRoot) {
    $env:Path = "$dotnetRoot;$env:Path"
}

Write-Host "Using .NET SDK: $dotnetExe"
& $dotnetExe --version
