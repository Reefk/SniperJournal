# Removes the "this file came from the internet" mark that Windows puts on
# everything extracted from a downloaded ZIP. Clearing it is what stops the
# launcher and the desktop shortcut warning every time they are opened.
param([Parameter(Mandatory = $true)][string]$Root)

try {
    $files = Get-ChildItem -LiteralPath $Root -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notlike '*\node_modules\*' -and $_.FullName -notlike '*\.next\*' }

    $files | Unblock-File -ErrorAction SilentlyContinue
    Write-Host "  Cleared the download mark from $($files.Count) files."
    exit 0
}
catch {
    Write-Host "  Could not clear the download mark: $($_.Exception.Message)"
    exit 1
}
