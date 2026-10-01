# Creates (or refreshes) the Sniper Journal shortcut on the desktop.
# Called by start.bat on the first run, and by create-shortcut.bat on demand.
param([Parameter(Mandatory = $true)][string]$Root)

try {
    $desktop = [Environment]::GetFolderPath('Desktop')
    if (-not $desktop -or -not (Test-Path $desktop)) {
        throw 'Could not find your desktop folder.'
    }

    $shell = New-Object -ComObject WScript.Shell
    $link = Join-Path $desktop 'Sniper Journal.lnk'
    $sc = $shell.CreateShortcut($link)
    $sc.TargetPath       = Join-Path $Root 'assets\open-app.vbs'
    $sc.WorkingDirectory = $Root
    $sc.Description      = 'Sniper Journal - your trading journal'

    $icon = Join-Path $Root 'assets\sniper-journal.ico'
    if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }

    $sc.Save()
    Write-Host "  Shortcut created: $link"
    exit 0
}
catch {
    Write-Host "  Could not create the shortcut: $($_.Exception.Message)"
    exit 1
}
