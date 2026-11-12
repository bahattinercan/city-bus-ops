#!/usr/bin/env pwsh
# Opens the Postgres tunnel to the Mint node (serverPC).
# Postgres + PostGIS runs as container `citybus-postgres`, bound to 127.0.0.1:5435 there.
# Usage: pwsh -File scripts/db-tunnel.ps1 [-Stop]

param([switch]$Stop)

$ErrorActionPreference = 'Stop'
$port = 5435
$target = 'mint'

if ($Stop) {
    $existing = Get-CimInstance Win32_Process -Filter "Name = 'ssh.exe'" |
        Where-Object { $_.CommandLine -like "*$port`:127.0.0.1:$port*" }

    if (-not $existing) {
        Write-Host "No tunnel on port $port is running."
        exit 0
    }

    $existing | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Write-Host "Tunnel on port $port stopped."
    exit 0
}

$probe = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
if ($probe) {
    Write-Host "Port $port already reachable (tunnel is up)."
    exit 0
}

Start-Process -FilePath 'ssh' -ArgumentList @(
    '-f', '-N', '-o', 'ExitOnForwardFailure=yes',
    '-L', "$port`:127.0.0.1:$port", $target
) -WindowStyle Hidden -Wait

$ready = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $ready) {
    throw "Tunnel did not come up: 127.0.0.1:$port is not reachable."
}

Write-Host "Tunnel up: 127.0.0.1:$port -> ${target}:127.0.0.1:$port"
