@echo off
REM Spike helper: prove ShellExecute can run a local script.
REM Writes a marker file under %LOCALAPPDATA%\chayuan-wps\mcp\spikes\
setlocal
set "DIR=%LOCALAPPDATA%\chayuan-wps\mcp\spikes"
if not exist "%DIR%" mkdir "%DIR%"
set "TS=%DATE% %TIME%"
echo shell-execute-ok %TS%> "%DIR%\marker-%RANDOM%.txt"
REM Also try to notify running sidecar (best-effort, ignore failure)
where curl >nul 2>nul
if not errorlevel 1 (
  if exist "%LOCALAPPDATA%\chayuan-wps\mcp\token" (
    for /f "usebackq delims=" %%T in ("%LOCALAPPDATA%\chayuan-wps\mcp\token") do set "TOK=%%T"
    curl -s -X POST "http://127.0.0.1:62588/spike/marker" -H "Authorization: Bearer %TOK%" -H "Content-Type: application/json" -d "{\"source\":\"shell-execute\"}" >nul 2>nul
  )
)
endlocal
exit /b 0
