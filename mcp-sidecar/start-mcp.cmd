@echo off
setlocal
cd /d "%~dp0"
if defined CHAYUAN_MCP_PORT (
  echo Using CHAYUAN_MCP_PORT=%CHAYUAN_MCP_PORT%
)
where node >nul 2>nul
if errorlevel 1 (
  echo [chayuan-mcp] Node.js not found in PATH. Install Node 18+ or run from a machine with node.
  pause
  exit /b 1
)
node "%~dp0server.mjs"
endlocal
