# Lum: podglad na zywo postepu kompilacji (czyta build-log.txt).
#
# Uzycie (w osobnym oknie PowerShell, z folderu repo):
#   powershell -ExecutionPolicy Bypass -File lum\devutils\build-status.ps1
# Zamykanie: Ctrl+C (kompilacji to nie przerywa).
#
# Kompilacje trzeba uruchomic z zapisem do logu, np.:
#   python3 build.py --tarball *>&1 | Tee-Object -FilePath build-log.txt

param(
    [string]$Log = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'build-log.txt'),
    [int]$RefreshSeconds = 5
)

$stages = @(
    'Pobieranie kodu Chromium',
    'Rozpakowywanie kodu Chromium',
    'Pobieranie narzedzi (Rust, LLVM, Node...)',
    'Nakladanie latek (ungoogled, Windows, Lum)',
    'Przygotowanie kompilacji (gn, bindgen)',
    'Kompilacja',
    'Gotowe'
)
$samples = New-Object System.Collections.Generic.List[object]

function Get-Stage($text, $done) {
    if ($done) { return 6 }
    if ($text -match '(?m)^\[\d+/\d+\]') { return 5 }
    if ($text -match 'Applying|LUM overlay') {
        $tail = ($text -split "`n" | Select-Object -Last 3) -join "`n"
        if ($tail -match 'Applying') { return 3 } else { return 4 }
    }
    if ($text -match 'Downloading required files|Unpacking downloads') { return 2 }
    if ($text -match 'Unpacking chromium tarball|Unpacking "chromium"') { return 1 }
    return 0
}

function Format-Span([TimeSpan]$t) { '{0}:{1:mm}' -f [int][Math]::Floor($t.TotalHours), $t }

while ($true) {
    if (-not (Test-Path $Log)) {
        Clear-Host; Write-Host "Brak pliku logu: $Log (czy kompilacja jest uruchomiona?)" -ForegroundColor Yellow
        Start-Sleep $RefreshSeconds; continue
    }
    $start = (Get-Item $Log).CreationTime
    $text = (Get-Content $Log -Raw -ErrorAction SilentlyContinue)
    if ($null -eq $text) { $text = '' }

    # Kompilacja: ostatnia linia [n/m]
    $n = 0; $m = 0
    $last = [regex]::Matches($text, '(?m)^\[(\d+)/(\d+)\]')
    if ($last.Count -gt 0) { $mm = $last[$last.Count - 1]; $n = [int]$mm.Groups[1].Value; $m = [int]$mm.Groups[2].Value }
    $running = [bool](Get-Process -Name python3, python, ninja -ErrorAction SilentlyContinue)
    $done = ($m -gt 0 -and $n -eq $m -and -not $running)
    $failed = $text -match 'Traceback \(most recent call last\)|FAILED: |Build failed|ninja: build stopped'
    $stage = Get-Stage $text $done

    # Tempo i ETA kompilacji z probek z ostatnich ~15 min
    $now = Get-Date
    if ($m -gt 0) {
        $samples.Add([pscustomobject]@{ T = $now; N = $n })
        while ($samples.Count -gt 2 -and ($now - $samples[0].T).TotalMinutes -gt 15) { $samples.RemoveAt(0) }
    }
    $eta = $null
    if ($samples.Count -ge 2) {
        $dt = ($samples[$samples.Count - 1].T - $samples[0].T).TotalSeconds
        $dn = $samples[$samples.Count - 1].N - $samples[0].N
        if ($dt -gt 30 -and $dn -gt 0) { $eta = [TimeSpan]::FromSeconds(($m - $n) * $dt / $dn) }
    }

    $cpu = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
    $free = (Get-PSDrive C).Free / 1GB
    $lastLine = ($text.TrimEnd() -split "`n" | Select-Object -Last 1)
    if ($lastLine.Length -gt 110) { $lastLine = $lastLine.Substring(0, 110) + '...' }

    Clear-Host
    Write-Host ("LUM - kompilacja    start {0:HH:mm}, trwa {1}    (odswiezanie co {2} s, Ctrl+C zamyka podglad)" -f $start, (Format-Span ($now - $start)), $RefreshSeconds) -ForegroundColor Cyan
    Write-Host ''
    for ($i = 0; $i -lt $stages.Count; $i++) {
        if ($i -lt $stage) { $mark = '[x]'; $color = 'Green' }
        elseif ($i -eq $stage) { $mark = '[>]'; $color = $(if ($failed) { 'Red' } else { 'Yellow' }) }
        else { $mark = '[ ]'; $color = 'DarkGray' }
        $line = " $mark $($i + 1). $($stages[$i])"
        if ($i -eq 5 -and $m -gt 0) {
            $pct = 100.0 * $n / $m
            $bar = ('#' * [int]($pct / 4)).PadRight(25, '-')
            $line += ("   [{0}] {1,5:N1}%  {2}/{3}" -f $bar, $pct, $n, $m)
            if ($eta -and -not $done) { $line += ("   zostalo ok. {0} (koniec ok. {1:HH:mm})" -f (Format-Span $eta), ($now + $eta)) }
        }
        Write-Host $line -ForegroundColor $color
    }
    Write-Host ''
    Write-Host ("CPU {0,3:N0}%    Wolne na C: {1:N0} GB    Kompilacja dziala: {2}" -f $cpu, $free, $(if ($running) { 'tak' } else { 'nie' }))
    Write-Host "Ostatnia linia: $lastLine" -ForegroundColor DarkGray
    if ($failed) { Write-Host "`nW logu jest BLAD - kompilacja mogla sie przerwac. Sprawdz koniec $Log" -ForegroundColor Red }
    if ($done) { Write-Host "`nKompilacja zakonczona. Nastepny krok: python3 package.py" -ForegroundColor Green }
    Start-Sleep $RefreshSeconds
}
