# Install chayuan-mcp user autostart via HKCU Run — binary variant (no Node.js).
# Uses the single-file sidecar binary in mcp-sidecar/bin/; falls back to node server.mjs
# only if the binary is absent (protects dev / legacy installs).
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

function Find-Node {
  try {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user, $env:Path) | Where-Object { $_ }) -join ';'
  } catch { }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  try {
    $where = (& where.exe node 2>$null | Select-Object -First 1)
    if ($where -and (Test-Path -LiteralPath $where)) { return $where }
  } catch { }
  return $null
}

if ($Uninstall) {
  Remove-ItemProperty -Path $RegPath -Name $RunName -ErrorAction SilentlyContinue
  Write-Host "Removed HKCU Run value: $RunName"
  exit 0
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Copy-Item -Path (Join-Path $Root '*') -Destination $RuntimeDir -Recurse -Force

# 优先单文件二进制（无需 Node）；缺失则回落 node server.mjs
$exe = Join-Path $RuntimeDir 'bin\chayuan-mcp-windows-x64.exe'
if (Test-Path -LiteralPath $exe) {
  $runValue = "`"$exe`""
  Write-Host "[chayuan-mcp] Run → native binary: $exe"
} else {
  $node = Find-Node
  $server = Join-Path $RuntimeDir 'server.mjs'
  if (-not $node -or -not (Test-Path -LiteralPath $server)) {
    Write-Error "Neither sidecar binary ($exe) nor node+server.mjs available."
  }
  $cmdPath = Join-Path $RuntimeDir 'start-mcp.cmd'
  $runValue = "`"$cmdPath`""
  Write-Host "[chayuan-mcp] Run → node server.mjs (binary not found at $exe)" -ForegroundColor Yellow
}

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
  if (Test-Path -LiteralPath $exe) {
    # Binary is compiled with --windows-hide-console; no black console window.
    Start-Process -FilePath $exe -WindowStyle Hidden
  } else {
    Start-Process -FilePath (Join-Path $RuntimeDir 'start-mcp.cmd') -WindowStyle Hidden
  }
  Write-Host 'Started sidecar (hidden).'
}
