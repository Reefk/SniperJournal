# Stops the background Sniper Journal server.
#
# Only a process that belongs to this copy of the app is stopped: its command
# line has to point inside this folder (the server runs as
# "node <this folder>\node_modules\...\next start"). Another program that
# happens to use port 3000 is left running.
param([int]$Port = 3000)

$root = Split-Path -Parent $PSScriptRoot
$mine = (Join-Path $root 'node_modules') + '\'

function Get-CommandLine([int]$Id) {
    try {
        return (Get-CimInstance Win32_Process -Filter "ProcessId=$Id" -ErrorAction Stop).CommandLine
    }
    catch {
        # older Windows without CIM: ask WMI instead
        try { return (Get-WmiObject Win32_Process -Filter "ProcessId=$Id" -ErrorAction Stop).CommandLine }
        catch { return $null }
    }
}

try {
    $pids = @()

    try {
        $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique
    }
    catch {
        # older Windows, or the cmdlet is unavailable: read netstat instead
        $pids = netstat -ano | Select-String ":$Port\s+.*LISTENING" | ForEach-Object {
            ($_ -split '\s+')[-1]
        } | Sort-Object -Unique
    }

    if (-not $pids) {
        Write-Host '  Sniper Journal was not running.'
        exit 0
    }

    $stopped = 0
    foreach ($id in $pids) {
        $commandLine = Get-CommandLine $id
        if ($commandLine -and $commandLine.IndexOf($mine, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
            $stopped++
        }
        else {
            $name = (Get-Process -Id $id -ErrorAction SilentlyContinue).ProcessName
            Write-Host "  Port $Port is used by another program ($name, process $id), not by"
            Write-Host "  the Sniper Journal in this folder, so it was left running."
        }
    }

    if ($stopped) { Write-Host '  Sniper Journal has been stopped.' }
    exit 0
}
catch {
    Write-Host "  Could not stop it: $($_.Exception.Message)"
    exit 1
}
