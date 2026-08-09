# Install chayuan-mcp user autostart via HKCU Run (Phase 3 lite — no Inno/NSIS).
# Requires Node.js 18+ on PATH.
# Usage:
#   powershell -ExecutionPolicy Bypass -File install-windows-user.ps1
#   powershell -ExecutionPolicy Bypass -File install-windows-user.ps1 -Uninstall
param(
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $env:LOCALAPPDATA 'chayuan-wps\mcp'
$RuntimeDir = Join-Path $DataDir 'runtime'
$RunName = 'ChayuanWpsMcp'
$RegPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'

function Refresh-PathFromRegistry {
  try {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user, $env:Path) | Where-Object { $_ }) -join ';'
  } catch { }
}

function Find-Node {
  Refresh-PathFromRegistry
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  try {
    $where = (& where.exe node 2>$null | Select-Object -First 1)
    if ($where -and (Test-Path -LiteralPath $where)) { return $where }
  } catch { }
  foreach ($candidate in @(
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\node\node.exe"
  )) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  return $null
}

if ($Uninstall) {
  Remove-ItemProperty -Path $RegPath -Name $RunName -ErrorAction SilentlyContinue
  Write-Host "Removed HKCU Run value: $RunName"
  exit 0
}

$node = Find-Node
if (-not $node) {
  Write-Error 'Node.js not found in PATH. Install Node 18+ then re-run.'
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Copy-Item -Path (Join-Path $Root '*') -Destination $RuntimeDir -Recurse -Force
$server = Join-Path $RuntimeDir 'server.mjs'
if (-not (Test-Path $server)) {
  Write-Error "Missing $server after copy"
}

$cmdPath = Join-Path $RuntimeDir 'start-mcp.cmd'
# Quote-safe Run value: cmd /c start minimized hidden-ish via start-mcp.cmd
$runValue = "`"$cmdPath`""
New-Item -Path $RegPath -Force | Out-Null
Set-ItemProperty -Path $RegPath -Name $RunName -Value $runValue -Type String

Write-Host "Installed user autostart:"
Write-Host "  Run name : $RunName"
Write-Host "  Command  : $runValue"
Write-Host "  Runtime  : $RuntimeDir"
Write-Host "  MCP URL  : http://127.0.0.1:62588/mcp"
Write-Host "Uninstall  : powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Uninstall"

# Best-effort start now (do not fail install if already listening)
try {
  $null = Invoke-WebRequest -Uri 'http://127.0.0.1:62588/healthz' -UseBasicParsing -TimeoutSec 2
  Write-Host 'Sidecar already running on :62588'
} catch {
  Start-Process -FilePath $cmdPath -WindowStyle Minimized
  Write-Host 'Started sidecar (minimized).'
}
