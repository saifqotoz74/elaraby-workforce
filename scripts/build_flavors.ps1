<#
.SYNOPSIS
    Automated Multi-Tenant Flavor Build Script for Windows PowerShell.
.DESCRIPTION
    Builds branded APKs or App Bundles for Elaraby, Elsewedy, GB Corp, TMG, Gulf Industrial, or Generic.
.PARAMETER Flavor
    Target enterprise flavor ('elaraby', 'elsewedy', 'ghabbour', 'tmg', 'gulf_industrial', 'generic', or 'all').
.PARAMETER Target
    Build target ('apk' or 'appbundle'). Defaults to 'apk'.
.PARAMETER Mode
    Build mode ('release' or 'debug'). Defaults to 'release'.
.EXAMPLE
    .\scripts\build_flavors.ps1 -Flavor elsewedy -Target apk -Mode release
    .\scripts\build_flavors.ps1 -Flavor all -Target apk
#>

param(
    [ValidateSet('elaraby', 'elsewedy', 'ghabbour', 'tmg', 'gulf_industrial', 'generic', 'all')]
    [string]$Flavor = 'all',

    [ValidateSet('apk', 'appbundle')]
    [string]$Target = 'apk',

    [ValidateSet('release', 'debug')]
    [string]$Mode = 'release'
)

$ErrorActionPreference = 'Stop'

# Auto-detect Android Studio JDK 17 on Windows if present
$androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $androidStudioJbr) {
    $env:JAVA_HOME = $androidStudioJbr
    $env:Path = "$androidStudioJbr\bin;$env:Path"
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Enterprise Multi-Tenant CI/CD Build Engine" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Target: $Target | Mode: $Mode | Requested Flavor: $Flavor" -ForegroundColor Yellow

$FlavorMap = @{
    'generic'         = 'lib/main.dart'
    'elaraby'         = 'lib/main_elaraby.dart'
    'elsewedy'        = 'lib/main_elsewedy.dart'
    'ghabbour'        = 'lib/main_ghabbour.dart'
    'tmg'             = 'lib/main_tmg.dart'
    'gulf_industrial' = 'lib/main_gulf.dart'
}

$FlavorsToBuild = @()
if ($Flavor -eq 'all') {
    $FlavorsToBuild = @('generic', 'elaraby', 'elsewedy', 'ghabbour', 'tmg', 'gulf_industrial')
} else {
    $FlavorsToBuild = @($Flavor)
}

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

$OutputDirBase = Join-Path $RootDir "build\outputs\tenants"

foreach ($currentFlavor in $FlavorsToBuild) {
    $entryPoint = $FlavorMap[$currentFlavor]
    Write-Host "`n>>> [BUILDING] Flavor: $currentFlavor | Entry: $entryPoint <<<" -ForegroundColor Green
    
    $buildArgs = @("build", $Target, "--flavor", $currentFlavor, "-t", $entryPoint, "--$Mode")
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    & flutter @buildArgs
    $stopwatch.Stop()

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed for flavor: $currentFlavor with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }

    $tenantOutputDir = Join-Path $OutputDirBase $currentFlavor
    if (-not (Test-Path $tenantOutputDir)) {
        New-Item -ItemType Directory -Path $tenantOutputDir -Force | Out-Null
    }

    if ($Target -eq 'apk') {
        $sourceDir = Join-Path $RootDir "build\app\outputs\flutter-apk"
        $builtApk = Get-ChildItem -Path $sourceDir -Filter "*$currentFlavor*$Mode.apk" | Select-Object -First 1
        if ($builtApk) {
            $destFile = Join-Path $tenantOutputDir "$($currentFlavor)_$($Mode).apk"
            Copy-Item -Path $builtApk.FullName -Destination $destFile -Force
            Write-Host "  [OK] Exported: $destFile ($([math]::Round($builtApk.Length / 1MB, 2)) MB in $($stopwatch.Elapsed.TotalSeconds.ToString('F1'))s)" -ForegroundColor Green
        }
    } elseif ($Target -eq 'appbundle') {
        $sourceDir = Join-Path $RootDir "build\app\outputs\bundle\$($currentFlavor)$($Mode.Substring(0,1).ToUpper())$($Mode.Substring(1))"
        $builtAab = Get-ChildItem -Path $sourceDir -Filter "*.aab" | Select-Object -First 1
        if ($builtAab) {
            $destFile = Join-Path $tenantOutputDir "$($currentFlavor)_$($Mode).aab"
            Copy-Item -Path $builtAab.FullName -Destination $destFile -Force
            Write-Host "  [OK] Exported: $destFile ($([math]::Round($builtAab.Length / 1MB, 2)) MB in $($stopwatch.Elapsed.TotalSeconds.ToString('F1'))s)" -ForegroundColor Green
        }
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  All requested tenant builds completed successfully!" -ForegroundColor Green
Write-Host "  Outputs located in: $OutputDirBase" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
