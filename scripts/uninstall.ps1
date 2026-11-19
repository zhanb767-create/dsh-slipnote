[CmdletBinding()]
param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }),
  [string]$Profile = 'desktop'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[dsh-slipnote] $Message"
}

if ($DshHome.StartsWith('~')) {
  $DshHome = Join-Path $HOME $DshHome.Substring(1).TrimStart('\', '/')
}

$PluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ProfileDir = Join-Path $DshHome "profiles\$Profile"
$Manifest = Join-Path $ProfileDir 'package.json'
$Link = Join-Path $ProfileDir 'node_modules\dsh-slipnote'

if (-not (Test-Path -LiteralPath $Manifest)) {
  Write-Step "Profile manifest not found: $Manifest"
  exit 1
}

# 1. Prefer the official CLI when it is on PATH.
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if ($null -ne $dsh) {
  Write-Step "Found DSH CLI, trying: dsh plugin --profile $Profile remove dsh-slipnote"
  & $dsh.Source plugin --profile $Profile remove dsh-slipnote
  if ($LASTEXITCODE -eq 0) {
    Write-Step "Removed through the DSH CLI."
    Write-Step "IMPORTANT: fully quit DSH, then start it again."
    exit 0
  }
  Write-Step "The CLI did not remove the plugin (exit $LASTEXITCODE). Falling back to a profile edit."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Backup = "$Manifest.dsh-slipnote-$stamp.bak"
Copy-Item -LiteralPath $Manifest -Destination $Backup -Force
Write-Step "Backup: $Backup"

try {
  $raw = [System.IO.File]::ReadAllText($Manifest)
  $json = $raw | ConvertFrom-Json

  if ($null -ne $json.dependencies -and $json.dependencies.PSObject.Properties.Name -contains 'dsh-slipnote') {
    $json.dependencies.PSObject.Properties.Remove('dsh-slipnote')
  }
  if ($null -ne $json.dsh -and $null -ne $json.dsh.profile -and $null -ne $json.dsh.profile.bundles) {
    $json.dsh.profile.bundles = @($json.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-slipnote' })
  }

  $text = $json | ConvertTo-Json -Depth 20
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Manifest, $text, $utf8)

  $check = [System.IO.File]::ReadAllText($Manifest) | ConvertFrom-Json
  if ($null -ne $check.dependencies -and $check.dependencies.PSObject.Properties.Name -contains 'dsh-slipnote') {
    throw 'The dependency entry is still present.'
  }
  if ($null -ne $check.dsh.profile.bundles -and @($check.dsh.profile.bundles) -contains 'dsh-slipnote') {
    throw 'The bundle entry is still present.'
  }

  if (Test-Path -LiteralPath $Link) {
    $item = Get-Item -LiteralPath $Link -Force
    if ($item.LinkType -eq 'Junction' -or $item.LinkType -eq 'SymbolicLink') {
      Remove-Item -LiteralPath $Link -Force
      Write-Step "Removed Junction: $Link"
    } else {
      Write-Step "Left a non-link directory in place: $Link"
    }
  }

  Write-Step "Profile manifest updated and validated."
  Write-Step "Your notes and plans were left in $DshHome\dsh-memo."
  Write-Step "IMPORTANT: fully quit DSH, then start it again."
  exit 0
} catch {
  Write-Host "[dsh-slipnote] ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Step "Rolling back the profile manifest."
  Copy-Item -LiteralPath $Backup -Destination $Manifest -Force
  Write-Step "Rollback complete. Manual steps are in README.md."
  exit 1
}
