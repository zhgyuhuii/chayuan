@echo off
setlocal EnableExtensions
REM Register chayuan-mcp user autostart (HKCU Run) and start now.
REM Prefer this .cmd over .ps1 — some Windows Defender policies quarantine *.ps1 under autostart/.
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
> "%RUNTIME%\start-mcp.cmd" echo @echo off
>> "%RUNTIME%\start-mcp.cmd" echo powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%%~dp0%EXE_NAME%' -WindowStyle Hidden"

REM Run key points to the generated start-mcp.cmd (hidden launch); launching the exe
REM directly would open a persistent console window at every logon
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v %RUN_NAME% /t REG_SZ /d "\"%RUNTIME%\start-mcp.cmd\"" /f >nul
echo [chayuan-mcp] Run -^> hidden launcher: %RUNTIME%\start-mcp.cmd

REM Start if not already listening
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri http://127.0.0.1:62588/healthz -UseBasicParsing -TimeoutSec 2 | Out-Null; Write-Host 'Sidecar already running on :62588' } catch { Start-Process -FilePath '%EXE_DST%' -WindowStyle Hidden; Write-Host 'Started sidecar (hidden).' }"
echo Installed user autostart: %RUN_NAME%
echo MCP URL  : http://127.0.0.1:62588/mcp
echo Uninstall: "%~f0" /uninstall
exit /b 0

:uninstall
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v %RUN_NAME% /f >nul 2>nul
echo Removed HKCU Run value: %RUN_NAME%
exit /b 0
