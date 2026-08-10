@echo off
setlocal
cd /d "%~dp0"

if defined CHAYUAN_MCP_PORT (
  echo Using CHAYUAN_MCP_PORT=%CHAYUAN_MCP_PORT%
)

rem Prefer packaged native binary (no Node.js required on target machines).
set "BIN=%~dp0bin\chayuan-mcp-windows-x64.exe"
if exist "%BIN%" (
  echo [chayuan-mcp] starting native binary: %BIN%
  start "" "%BIN%"
  exit /b 0
)

rem Also accept binary next to this script (SFX runtime layout).
set "BIN_FLAT=%~dp0chayuan-mcp-windows-x64.exe"
if exist "%BIN_FLAT%" (
  echo [chayuan-mcp] starting native binary: %BIN_FLAT%
  start "" "%BIN_FLAT%"
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo [chayuan-mcp] Neither chayuan-mcp-windows-x64.exe nor Node.js found.
  echo Install the packaged binary under bin\ or install Node 18+, then retry.
  pause
  exit /b 1
)
echo [chayuan-mcp] binary missing; falling back to node server.mjs
node "%~dp0server.mjs"
endlocal
