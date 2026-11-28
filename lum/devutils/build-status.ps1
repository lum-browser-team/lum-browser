# Lum: live build progress (reads build-log.txt).
#
# Usage (in a separate PowerShell window, from the repo folder):
#   powershell -ExecutionPolicy Bypass -File lum\devutils\build-status.ps1
# Close with Ctrl+C (it does not stop the build).
#
# The build must write a log, e.g.:
#   python3 build.py --tarball *>&1 | Tee-Object -FilePath build-log.txt

param(
    [string]$Log = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'build-log.txt'),
    [int]$RefreshSeconds = 5
)

$stages = @(
    'Downloading the Chromium code',
    'Unpacking the Chromium code',
    'Downloading tools (Rust, LLVM, Node...)',
    'Applying patches (ungoogled, Windows, Lum)',
    'Preparing the build (gn, bindgen)',
    'Compiling',
    'Done'
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
        Clear-Host; Write-Host "No log file: $Log (is the build running?)" -ForegroundColor Yellow
        Start-Sleep $RefreshSeconds; continue
    }
    $start = (Get-Item $Log).CreationTime
    $text = (Get-Content $Log -Raw -ErrorAction SilentlyContinue)
    if ($null -eq $text) { $text = '' }

    # Compile progress: the last [n/m] line
    $n = 0; $m = 0
    $last = [regex]::Matches($text, '(?m)^\[(\d+)/(\d+)\]')
    if ($last.Count -gt 0) { $mm = $last[$last.Count - 1]; $n = [int]$mm.Groups[1].Value; $m = [int]$mm.Groups[2].Value }
    $running = [bool](Get-Process -Name python3, python, ninja -ErrorAction SilentlyContinue)
    $done = ($m -gt 0 -and $n -eq $m -and -not $running)
    $failed = $text -match 'Traceback \(most recent call last\)|FAILED: |Build failed|ninja: build stopped'
    $stage = Get-Stage $text $done

    # Speed and ETA from the samples of the last ~15 min
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
    Write-Host ("LUM - build    started {0:HH:mm}, running {1}    (refresh every {2} s, Ctrl+C closes this view)" -f $start, (Format-Span ($now - $start)), $RefreshSeconds) -ForegroundColor Cyan
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
            if ($eta -and -not $done) { $line += ("   about {0} left (done at about {1:HH:mm})" -f (Format-Span $eta), ($now + $eta)) }
        }
        Write-Host $line -ForegroundColor $color
    }
    Write-Host ''
    Write-Host ("CPU {0,3:N0}%    Free on C: {1:N0} GB    Build running: {2}" -f $cpu, $free, $(if ($running) { 'yes' } else { 'no' }))
    Write-Host "Last line: $lastLine" -ForegroundColor DarkGray
    if ($failed) { Write-Host "`nThe log has an ERROR - the build may have stopped. Check the end of $Log" -ForegroundColor Red }
    if ($done) { Write-Host "`nBuild finished. Next step: python3 package.py" -ForegroundColor Green }
    Start-Sleep $RefreshSeconds
}
