# Lum: installs everything needed to build on Windows 10/11 x64.
#
# Run in PowerShell AS ADMINISTRATOR, from the repo folder:
#   powershell -ExecutionPolicy Bypass -File lum\devutils\setup-windows.ps1
#
# Installs (via winget): Python 3.12, 7-Zip, Visual Studio Community 2026
# (C++ + MFC/ATL), Windows SDK 10.0.28000 with debuggers. Sets up python3.exe,
# pip packages and long path support. At the end you have to turn off the
# Python aliases manually and restart the computer (the script prints this).
#
# The VS and SDK versions come from Chromium 158 (build/vs_toolchain.py,
# docs/windows_build_instructions.md). Check them again when updating Chromium.

$ErrorActionPreference = 'Stop'

function Install-Pkg($id, $override) {
    Write-Host "`n==> $id" -ForegroundColor Cyan
    $wingetArgs = @('install', '--id', $id, '-e', '--accept-package-agreements', '--accept-source-agreements')
    if ($override) { $wingetArgs += @('--override', $override) }
    & winget @wingetArgs
    # winget returns a non-zero code also when the package is already installed - do not stop
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Run this script in PowerShell as administrator.' }

$free = (Get-PSDrive C).Free / 1GB
Write-Host ("Free space on C: {0:N0} GB (about 100 GB is needed for the tools and the build)" -f $free)

Install-Pkg 'Python.Python.3.12' '/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1'
Install-Pkg '7zip.7zip' $null
Install-Pkg 'Microsoft.VisualStudio.Community' '--add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Component.VC.ATLMFC --includeRecommended --passive --wait --norestart'
Install-Pkg 'Microsoft.WindowsSDK.10.0.28000' '/features OptionId.DesktopCPPx64 OptionId.DesktopCPPx86 OptionId.WindowsDesktopDebuggers OptionId.UWPCPP OptionId.SigningTools /q /norestart /ceip off'

# python3.exe + packages required by the ungoogled-chromium scripts
$py = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312'
if (-not (Test-Path "$py\python.exe")) { throw "Python not found in $py" }
if (-not (Test-Path "$py\python3.exe")) { Copy-Item "$py\python.exe" "$py\python3.exe" }
& "$py\python.exe" -m pip install --disable-pip-version-check -q httplib2==0.22.0 clang==21.1.7

# Long paths (Chromium has paths > 260 characters)
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -Value 1 -Type DWord

# Check
Write-Host "`n==> Check" -ForegroundColor Cyan
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsOk = (Test-Path $vswhere) -and [bool](& $vswhere -products * -latest -requires Microsoft.VisualStudio.Workload.NativeDesktop Microsoft.VisualStudio.Component.VC.ATLMFC -property displayName)
$checks = [ordered]@{
    'Python 3.12 + python3.exe'   = (Test-Path "$py\python3.exe")
    '7-Zip'                       = (Test-Path 'C:\Program Files\7-Zip\7z.exe')
    'Visual Studio C++ + MFC/ATL' = $vsOk
    'Windows SDK 10.0.28000'      = (Test-Path "${env:ProgramFiles(x86)}\Windows Kits\10\Include\10.0.28000.0")
    'SDK debuggers'               = (Test-Path "${env:ProgramFiles(x86)}\Windows Kits\10\Debuggers\x64\cdb.exe")
    'Long paths'                  = ((Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem').LongPathsEnabled -eq 1)
}
$checks.GetEnumerator() | ForEach-Object { '{0,-30} {1}' -f $_.Key, $(if ($_.Value) { 'OK' } else { 'MISSING' }) }

$aliases = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WindowsApps" -Filter 'python*.exe' -ErrorAction SilentlyContinue
Write-Host "`nLeft to do manually:" -ForegroundColor Yellow
if ($aliases) {
    Write-Host ' 1. Settings > Apps > Advanced app settings > App execution aliases:'
    Write-Host '    turn off the "App Installer" python.exe and python3.exe.'
    Start-Process 'ms-settings:advanced-apps'
}
Write-Host ' 2. Restart the computer (Visual Studio requires it).'
