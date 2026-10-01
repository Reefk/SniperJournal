# Turns "start Sniper Journal with Windows" on or off by putting a shortcut
# in the Startup folder. The shortcut runs the hidden launcher, so nothing
# appears on screen when you sign in.
param(
    [Parameter(Mandatory = $true)][string]$Root,
    [switch]$Disable
)

try {
    $startup = [Environment]::GetFolderPath('Startup')
    $link = Join-Path $startup 'Sniper Journal.lnk'

    if ($Disable) {
        if (Test-Path $link) {
            Remove-Item $link -Force
            Write-Host '  Sniper Journal will no longer start with Windows.'
        } else {
            Write-Host '  It was not set to start with Windows.'
        }
        exit 0
    }

    $shell = New-Object -ComObject WScript.Shell
    $sc = $shell.CreateShortcut($link)
    $sc.TargetPath       = Join-Path $Root 'assets\run-hidden.vbs'
    $sc.WorkingDirectory = $Root
    $sc.Description      = 'Starts the Sniper Journal server in the background'

    $icon = Join-Path $Root 'assets\sniper-journal.ico'
    if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }

    $sc.Save()
    Write-Host '  Sniper Journal will now start quietly with Windows.'
    exit 0
}
catch {
    Write-Host "  Could not change the startup setting: $($_.Exception.Message)"
    exit 1
}
