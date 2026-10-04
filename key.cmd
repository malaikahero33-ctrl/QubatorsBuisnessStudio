@echo off
REM =============================================================================
REM key.cmd - set the AI API key, one prompt, no navigation.
REM
REM Double-click this, or type its path into a terminal and press Enter.
REM A .cmd is used deliberately: PowerShell's execution policy blocks
REM .ps1 files on many machines, but not .cmd, so this always runs.
REM =============================================================================

setlocal

cd /d "C:\dev\QubatorsBuisnessStudio"

echo.
echo   Qubators - set your AI key
echo   ================================
echo.
echo   Where does your key come from?
echo.
echo     1 = Groq     (starts gsk_)  https://console.groq.com/keys
echo     2 = OpenAI   (starts sk-)
echo.

set "choice="
set /p "choice=  Type 1 or 2 and press Enter: "

if "%choice%"=="1" (
  set "PROV=groq"
) else if "%choice%"=="2" (
  set "PROV=openai"
) else (
  echo.
  echo   Please type 1 or 2.
  pause
  exit /b 1
)

echo.
set /p "KEY=Paste your API key and press Enter: "

if "%KEY%"=="" (
  echo.
  echo   Nothing entered. Nothing was changed.
  pause
  exit /b 1
)

REM Check the prefix before writing, so a wrong key is caught here rather
REM than as an unexplained 401 from the provider later.
set "PREFIX=%KEY:~0,4%"
if "%PROV%"=="groq" (
  if not "%PREFIX%"=="gsk_" (
    echo.
    echo   ERROR: a Groq key starts with gsk_, but yours starts with %PREFIX%
    echo   Nothing was written. Check the key and try again.
    pause
    exit /b 1
  )
)
if "%PROV%"=="openai" (
  if not "%PREFIX:~0,3%"=="sk-" (
    echo.
    echo   ERROR: an OpenAI key starts with sk-, but yours starts with %PREFIX%
    echo   Nothing was written. Check the key and try again.
    pause
    exit /b 1
  )
)

REM Passed via an environment variable, not a command-line argument: on Windows
REM any process can list another process's command line, and this key would be
REM visible there for as long as the script runs.
set "QUBATORS_AI_KEY=%KEY%"
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\dev\QubatorsBuisnessStudio\scripts\set-ai-key.ps1" -Provider %PROV%
set "QUBATORS_AI_KEY="

pause