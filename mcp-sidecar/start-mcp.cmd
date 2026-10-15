@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Multi-OS launcher: native binary (Win10/11, bun build) with automatic
rem Node.js fallback for Win7/8/8.1 (bun-built binary cannot run there;
rem server.mjs needs only Node 14.18+/16 -- fetch is polyfilled).
rem Node preference order on Win7/8: bundled portable runtime (nodejs\node.exe,
rem shipped by the installer for offline intranet use) -> system node on PATH.
rem Full trace goes to sidecar-start.log next to this script.
set "LOG=%~dp0sidecar-start.log"
set "EXE_NAME=chayuan-mcp-windows-x64.exe"
set "EXE=%~dp0bin\%EXE_NAME%"
if not exist "%EXE%" set "EXE=%~dp0%EXE_NAME%"
set "NODE_EXE=%~dp0nodejs\node.exe"
if not exist "%NODE_EXE%" (
  for /f "delims=" %%i in ('where node 2^>nul') do set "NODE_EXE=%%i"
)
rem 0) already healthy? silent exit -- the watchdog task runs this every 2 minutes,
rem so the healthy path must not grow the log
call :healthz_ok
if not errorlevel 1 (
  endlocal & exit /b 0
)
echo [%DATE% %TIME%] launcher begin (unhealthy on 62588)>> "%LOG%"
if defined CHAYUAN_MCP_PORT echo [%DATE% %TIME%] CHAYUAN_MCP_PORT=%CHAYUAN_MCP_PORT% (healthz probe still uses 62588)>> "%LOG%"

rem 1) try native binary (Win10/11 only -- the bun exe hangs, never starts, on
rem Win7/8), then verify it really came up
set "SKIP_EXE="
ver | findstr /C:"5." /C:"6.0" /C:"6.1" /C:"6.2" /C:"6.3" >nul
if not errorlevel 1 set "SKIP_EXE=1"
if not defined SKIP_EXE if exist "%EXE%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%EXE%' -WindowStyle Hidden" >> "%LOG%" 2>&1
  ping -n 4 127.0.0.1 >nul
  call :healthz_ok
  if not errorlevel 1 (
    echo [%DATE% %TIME%] native binary OK>> "%LOG%"
    endlocal & exit /b 0
  )
  echo [%DATE% %TIME%] native binary did not become healthy - falling back to node>> "%LOG%"
)

rem 2) node fallback (Node 16 x64 recommended on Win7; 14.18+ works, fetch polyfilled)
if not exist "%NODE_EXE%" (
  echo [%DATE% %TIME%] ERROR: binary incompatible and no Node.js found - neither bundled nodejs\node.exe nor node on PATH.>> "%LOG%"
  endlocal
  echo [chayuan-mcp] ERROR: no Node.js runtime found. The installer should bundle nodejs\node.exe next to this script.
  exit /b 1
)
echo [%DATE% %TIME%] starting node fallback via %NODE_EXE%>> "%LOG%"
rem cwd is this dir (cd /d above); server.mjs relative avoids quoting hell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%NODE_EXE%' -ArgumentList 'server.mjs' -WindowStyle Hidden" >> "%LOG%" 2>&1
ping -n 5 127.0.0.1 >nul
call :healthz_ok
if not errorlevel 1 (
  echo [%DATE% %TIME%] node fallback OK>> "%LOG%"
  endlocal & exit /b 0
)
echo [%DATE% %TIME%] ERROR: node fallback not healthy. Run "%NODE_EXE%" "%~dp0server.mjs" in a console to see the reason.>> "%LOG%"
echo [chayuan-mcp] node fallback failed. Run: "%NODE_EXE%" "%~dp0server.mjs"
endlocal
exit /b 1

:healthz_ok
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { (New-Object Net.WebClient).DownloadString('http://127.0.0.1:62588/healthz') | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 exit /b 1
exit /b 0
