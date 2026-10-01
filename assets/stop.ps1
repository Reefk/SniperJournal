# Stops the background Sniper Journal server.
try {
    $pids = @()

    try {
        $pids = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique
    }
    catch {
        # older Windows, or the cmdlet is unavailable: read netstat instead
        $pids = netstat -ano | Select-String ':3000\s+.*LISTENING' | ForEach-Object {
            ($_ -split '\s+')[-1]
        } | Sort-Object -Unique
    }

    if (-not $pids) {
        Write-Host '  Sniper Journal was not running.'
        exit 0
    }

    foreach ($id in $pids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    Write-Host '  Sniper Journal has been stopped.'
    exit 0
}
catch {
    Write-Host "  Could not stop it: $($_.Exception.Message)"
    exit 1
}
