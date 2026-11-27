# Lum: instaluje wszystko, co jest potrzebne do kompilacji na Windows 10/11 x64.
#
# Uruchom w PowerShell JAKO ADMINISTRATOR, z folderu repo:
#   powershell -ExecutionPolicy Bypass -File lum\devutils\setup-windows.ps1
#
# Instaluje (przez winget): Python 3.12, 7-Zip, Visual Studio Community 2026
# (C++ + MFC/ATL), Windows SDK 10.0.28000 z debuggerami. Ustawia python3.exe,
# pakiety pip i obsluge dlugich sciezek. Na koncu trzeba recznie wylaczyc
# aliasy Pythona i zrestartowac komputer (skrypt to wypisze).
#
# Wersje VS i SDK wynikaja z Chromium 158 (build/vs_toolchain.py,
# docs/windows_build_instructions.md). Przy aktualizacji Chromium sprawdz je ponownie.

$ErrorActionPreference = 'Stop'

function Install-Pkg($id, $override) {
    Write-Host "`n==> $id" -ForegroundColor Cyan
    $wingetArgs = @('install', '--id', $id, '-e', '--accept-package-agreements', '--accept-source-agreements')
    if ($override) { $wingetArgs += @('--override', $override) }
    & winget @wingetArgs
    # winget zwraca kod != 0 takze gdy pakiet jest juz zainstalowany - nie przerywamy
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Uruchom ten skrypt w PowerShell jako administrator.' }

$free = (Get-PSDrive C).Free / 1GB
Write-Host ("Wolne miejsce na C: {0:N0} GB (potrzeba ok. 100 GB na narzedzia i kompilacje)" -f $free)

Install-Pkg 'Python.Python.3.12' '/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1'
Install-Pkg '7zip.7zip' $null
Install-Pkg 'Microsoft.VisualStudio.Community' '--add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Component.VC.ATLMFC --includeRecommended --passive --wait --norestart'
Install-Pkg 'Microsoft.WindowsSDK.10.0.28000' '/features OptionId.DesktopCPPx64 OptionId.DesktopCPPx86 OptionId.WindowsDesktopDebuggers OptionId.UWPCPP OptionId.SigningTools /q /norestart /ceip off'

# python3.exe + pakiety wymagane przez skrypty ungoogled-chromium
$py = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312'
if (-not (Test-Path "$py\python.exe")) { throw "Nie znaleziono Pythona w $py" }
if (-not (Test-Path "$py\python3.exe")) { Copy-Item "$py\python.exe" "$py\python3.exe" }
& "$py\python.exe" -m pip install --disable-pip-version-check -q httplib2==0.22.0 clang==21.1.7

# Dlugie sciezki (Chromium ma sciezki > 260 znakow)
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -Value 1 -Type DWord

# Sprawdzenie
Write-Host "`n==> Sprawdzenie" -ForegroundColor Cyan
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsOk = (Test-Path $vswhere) -and [bool](& $vswhere -products * -latest -requires Microsoft.VisualStudio.Workload.NativeDesktop Microsoft.VisualStudio.Component.VC.ATLMFC -property displayName)
$checks = [ordered]@{
    'Python 3.12 + python3.exe'   = (Test-Path "$py\python3.exe")
    '7-Zip'                       = (Test-Path 'C:\Program Files\7-Zip\7z.exe')
    'Visual Studio C++ + MFC/ATL' = $vsOk
    'Windows SDK 10.0.28000'      = (Test-Path "${env:ProgramFiles(x86)}\Windows Kits\10\Include\10.0.28000.0")
    'Debuggery SDK'               = (Test-Path "${env:ProgramFiles(x86)}\Windows Kits\10\Debuggers\x64\cdb.exe")
    'Dlugie sciezki'              = ((Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem').LongPathsEnabled -eq 1)
}
$checks.GetEnumerator() | ForEach-Object { '{0,-30} {1}' -f $_.Key, $(if ($_.Value) { 'OK' } else { 'BRAK' }) }

$aliases = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WindowsApps" -Filter 'python*.exe' -ErrorAction SilentlyContinue
Write-Host "`nZostalo recznie:" -ForegroundColor Yellow
if ($aliases) {
    Write-Host ' 1. Ustawienia > Aplikacje > Zaawansowane ustawienia aplikacji > Aliasy wykonywania aplikacji:'
    Write-Host '    wylacz "Instalator aplikacji" python.exe i python3.exe.'
    Start-Process 'ms-settings:advanced-apps'
}
Write-Host ' 2. Zrestartuj komputer (wymaga tego Visual Studio).'
