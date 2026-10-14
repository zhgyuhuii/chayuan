@echo off
setlocal EnableExtensions
REM Register chayuan-mcp user autostart (HKCU Run) and start now.
REM Prefer this .cmd over .ps1 -- some Windows Defender policies quarantine *.ps1 under autostart/.
REM Usage:
REM   install-windows-user.cmd
REM   install-windows-user.cmd /uninstall

set "ROOT=%~dp0.."
set "RUNTIME=%LOCALAPPDATA%\chayuan-wps\mcp\runtime"
set "EXE_NAME=chayuan-mcp-windows-x64.exe"
set "EXE_SRC=%ROOT%\bin\%EXE_NAME%"
set "EXE_DST=%RUNTIME%\%EXE_NAME%"
set "RUN_NAME=ChayuanWpsMcp"

if /I "%~1"=="/uninstall" goto :uninstall
if /I "%~1"=="-Uninstall" goto :uninstall

if not exist "%EXE_SRC%" (
  echo [chayuan-mcp] ERROR: missing binary "%EXE_SRC%"
  echo Build it first: npm run mcp:build-binary
  exit /b 1
)

if not exist "%RUNTIME%" mkdir "%RUNTIME%"
if not exist "%RUNTIME%\bin" mkdir "%RUNTIME%\bin"
copy /Y "%EXE_SRC%" "%EXE_DST%" >nul
copy /Y "%EXE_SRC%" "%RUNTIME%\bin\%EXE_NAME%" >nul
REM Node fallback payload for Win7/8 (bun exe cannot run there): server.mjs + lib
REM + the multi-OS start-mcp.cmd (try exe -> healthz -> node) from this repo tree
copy /Y "%ROOT%\start-mcp.cmd" "%RUNTIME%\start-mcp.cmd" >nul
copy /Y "%ROOT%\server.mjs" "%RUNTIME%\" >nul
xcopy /E /I /Y /Q "%ROOT%\lib" "%RUNTIME%\lib\" >nul
copy /Y "%ROOT%\chayuan-mcp-watch.vbs" "%RUNTIME%\" >nul

REM Watchdog: every 2 minutes, hidden via vbs; start-mcp.cmd is a silent no-op
REM while healthz answers -- self-heals after crash or a missed logon start
schtasks /Create /F /TN ChayuanWpsMcpWatch /SC MINUTE /MO 2 /TR "wscript.exe \"%RUNTIME%\chayuan-mcp-watch.vbs\"" >nul 2>nul
if not errorlevel 1 (
  echo [chayuan-mcp] Watchdog task installed: ChayuanWpsMcpWatch ^(every 2 min^)
) else (
  echo [chayuan-mcp] WARN: schtasks registration failed ^(hardened policy?^), relying on Run key only
)

REM Run key points to start-mcp.cmd (hidden launch; node fallback on Win7/8)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v %RUN_NAME% /t REG_SZ /d "\"%RUNTIME%\start-mcp.cmd\"" /f >nul
echo [chayuan-mcp] Run -^> hidden launcher: %RUNTIME%\start-mcp.cmd

REM Start via the launcher (it skips if healthz already answers on 62588)
call "%RUNTIME%\start-mcp.cmd"
echo Installed user autostart: %RUN_NAME%
echo MCP URL  : http://127.0.0.1:62588/mcp
echo Uninstall: "%~f0" /uninstall
exit /b 0

:uninstall
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v %RUN_NAME% /f >nul 2>nul
schtasks /Delete /TN ChayuanWpsMcpWatch /F >nul 2>nul
echo Removed HKCU Run value: %RUN_NAME%
echo Removed watchdog task: ChayuanWpsMcpWatch
exit /b 0
