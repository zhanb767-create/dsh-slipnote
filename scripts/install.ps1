[CmdletBinding()]
param(
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }),
  [string]$Profile = 'desktop'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "[dsh-slipnote] $Message"
}

function Stop-Install([string]$Message) {
  Write-Host "[dsh-slipnote] ERROR: $Message" -ForegroundColor Red
  exit 1
}

if ($DshHome.StartsWith('~')) {
  $DshHome = Join-Path $HOME $DshHome.Substring(1).TrimStart('\', '/')
}

$PluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ProfileDir = Join-Path $DshHome "profiles\$Profile"
$Manifest = Join-Path $ProfileDir 'package.json'
$NodeModules = Join-Path $ProfileDir 'node_modules'
$Link = Join-Path $NodeModules 'dsh-slipnote'

if (-not (Test-Path -LiteralPath $Manifest)) {
  Stop-Install "Profile manifest not found: $Manifest"
}

Write-Step "Plugin directory: $PluginDir"
Write-Step "Profile: $ProfileDir"

# 1. Prefer the official CLI when it is on PATH.
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if ($null -ne $dsh) {
  Write-Step "Found DSH CLI, trying: dsh plugin --profile $Profile add link:$PluginDir"
  & $dsh.Source plugin --profile $Profile add "link:$PluginDir"
  if ($LASTEXITCODE -eq 0) {
    Write-Step "Installed through the DSH CLI."
    Write-Step "IMPORTANT: fully quit DSH, then start it again. A page refresh is not enough."
    exit 0
  }
  Write-Step "The CLI did not install the plugin (exit $LASTEXITCODE). Falling back to a profile link."
}

# 2. Fallback: edit the profile manifest with a backup and a Junction.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Backup = "$Manifest.dsh-slipnote-$stamp.bak"
Copy-Item -LiteralPath $Manifest -Destination $Backup -Force
Write-Step "Backup: $Backup"

$createdLink = $false
try {
  $raw = [System.IO.File]::ReadAllText($Manifest)
  $json = $raw | ConvertFrom-Json

  if ($null -eq $json.dependencies) {
    $json | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{})
  }
  $linkSpec = 'link:' + ($PluginDir -replace '\\', '/')
  if ($json.dependencies.PSObject.Properties.Name -contains 'dsh-slipnote') {
    $json.dependencies.'dsh-slipnote' = $linkSpec
  } else {
    $json.dependencies | Add-Member -NotePropertyName 'dsh-slipnote' -NotePropertyValue $linkSpec
  }

  if ($null -eq $json.dsh) {
    $json | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{})
  }
  if ($null -eq $json.dsh.profile) {
    $json.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{})
  }
  if ($null -eq $json.dsh.profile.bundles) {
    $json.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue @()
  }
  $bundles = @($json.dsh.profile.bundles)
  if ($bundles -notcontains 'dsh-slipnote') {
    $bundles += 'dsh-slipnote'
  }
  $json.dsh.profile.bundles = @($bundles)

  $text = $json | ConvertTo-Json -Depth 20
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Manifest, $text, $utf8)

  # Validate that the manifest is still parseable before touching node_modules.
  $check = [System.IO.File]::ReadAllText($Manifest) | ConvertFrom-Json
  if ($check.dependencies.'dsh-slipnote' -ne $linkSpec) {
    throw 'The dependency entry was not written correctly.'
  }
  if (@($check.dsh.profile.bundles) -notcontains 'dsh-slipnote') {
    throw 'The bundle entry was not written correctly.'
  }

  if (-not (Test-Path -LiteralPath $NodeModules)) {
    New-Item -ItemType Directory -Path $NodeModules | Out-Null
  }

  if (Test-Path -LiteralPath $Link) {
    $item = Get-Item -LiteralPath $Link -Force
    if ($item.LinkType -ne 'Junction' -and $item.LinkType -ne 'SymbolicLink') {
      throw "An existing non-link path blocks the install: $Link"
    }
    $target = (Resolve-Path -LiteralPath $Link).Path
    if ($target -ne (Resolve-Path -LiteralPath $PluginDir).Path) {
      throw "The existing link points somewhere else: $target"
    }
    Write-Step "Link already points at the plugin directory."
  } else {
    New-Item -ItemType Junction -Path $Link -Target $PluginDir | Out-Null
    $createdLink = $true
    Write-Step "Created Junction: $Link"
  }

  Write-Step "Profile manifest updated and validated."
  Write-Step "IMPORTANT: fully quit DSH, then start it again. A page refresh is not enough."
  Write-Step "If the row does not appear, check the manual steps in README.md."
  exit 0
} catch {
  Write-Host "[dsh-slipnote] ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Step "Rolling back the profile manifest."
  Copy-Item -LiteralPath $Backup -Destination $Manifest -Force
  if ($createdLink -and (Test-Path -LiteralPath $Link)) {
    try { Remove-Item -LiteralPath $Link -Force } catch { }
  }
  Write-Step "Rollback complete. Manual steps are in README.md."
  exit 1
}
