@echo off
REM =============================================================================
REM key.cmd - set the AI API key.
REM
REM Reports the CURRENT state before asking anything, so running it always
REM produces visible output. If it seems to do nothing, that is the bug this
REM first section was added to fix.
REM =============================================================================

setlocal enabledelayedexpansion
cd /d "C:\dev\QubatorsBuisnessStudio"

echo.
echo   ============================================
echo    Qubators - AI key
echo   ============================================
echo.

REM ---- step 1: show what is currently configured -----------------------------
echo   CURRENT STATE
echo   --------------------------------------------

if exist ".env.local" (
  echo     .env.local      found
) else (
  echo     .env.local      NOT FOUND
  echo.
  echo     Copy .env.example to .env.local first.
  pause
  exit /b 1
)

set "CUR_PROV=not set"
set "CUR_KEY=not set"
for /f "tokens=1,* delims==" %%a in ('findstr /b "AI_PROVIDER=" ".env.local" 2^>nul') do set "CUR_PROV=%%b"
for /f "tokens=1,* delims==" %%a in ('findstr /b "AI_API_KEY=" ".env.local" 2^>nul') do set "CUR_KEY=%%b"

echo     AI_PROVIDER = !CUR_PROV!

REM Show only the first 6 characters. The full key is never printed.
if "!CUR_KEY!"=="not set" (
  echo     AI_API_KEY   = not set
) else (
  set "STRIPPED=!CUR_KEY:"=!"
  if "!STRIPPED!"=="PASTE_YOUR_GROQ_KEY_HERE" (
    echo     AI_API_KEY   = still the placeholder - not a real key
  ) else if "!STRIPPED!"=="" (
    echo     AI_API_KEY   = empty
  ) else (
    set "HEAD=!STRIPPED:~0,6!"
    call :len L "!STRIPPED!"
    echo     AI_API_KEY   = !HEAD!...  ^(!L! characters^)
  )
)

echo.
echo   --------------------------------------------

REM ---- step 2: pick a provider ----------------------------------------------
echo.
echo   Which service is your key from?
echo.
echo     1 = Groq    (key starts gsk_)
echo     2 = OpenAI  (key starts sk-)
echo     3 = Skip - the key above is already correct
echo.

set "choice="
set /p "choice=  Type 1, 2 or 3 and press Enter: "

if "%choice%"=="3" goto :done
if "%choice%"=="1" set "PROV=groq"
if "%choice%"=="2" set "PROV=openai"
if "%choice%"=="" goto :cancelled
if not defined PROV (
  echo.
  echo   Unrecognised answer. Nothing was changed.
  goto :cancelled
)

REM ---- step 3: read the key -------------------------------------------------
echo.
set "KEY="
set /p "KEY=  Paste your API key and press Enter: "

if "%KEY%"=="" (
  echo.
  echo   Nothing entered. Nothing was changed.
  goto :cancelled
)

REM ---- step 4: check before writing -----------------------------------------
set "PREFIX=%KEY:~0,4%"

if "%PROV%"=="groq" (
  if not "%PREFIX%"=="gsk_" (
    echo.
    echo   REFUSED - a Groq key starts with gsk_, yours starts with %PREFIX%
    echo   Nothing was written.
    goto :cancelled
  )
)

if "%PROV%"=="openai" (
  if not "%PREFIX:~0,3%"=="sk-" (
    echo.
    echo   REFUSED - an OpenAI key starts with sk-, yours starts with %PREFIX%
    echo   Nothing was written.
    goto :cancelled
  )
)

REM Keep the original for comparison. A copy with every space removed is made
REM alongside it: if the two differ, the key had a space in it. Comparing the
REM original against a stripped copy is what makes this work - stripping the
REM original first and then comparing would always match.
set "KEY_NO_SPACES=%KEY: =%"

if not "%KEY%"=="%KEY_NO_SPACES%" (
  echo.
  echo   REFUSED - the key contains a space. Retype it without any spaces.
  echo   Nothing was written.
  goto :cancelled
)

REM A stray carriage return from redirected input would be written into the
REM file and rejected by the provider as an invalid key. Only strip it after
REM the space check, so a genuine space is still caught above.
set "KEY=%KEY:	=%"
for /f "tokens=* delims= " %%a in ("%KEY%") do set "KEY=%%a"

REM ---- step 5: write ---------------------------------------------------------
set "QBS_PROV=%PROV%"
set "QBS_KEY=%KEY%"
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\dev\QubatorsBuisnessStudio\scripts\set-ai-key.ps1" -Provider %PROV%
set "QBS_KEY="
set "QBS_PROV="

echo.
echo   ------------------------------------------------
echo    SAVED. Restart the app, then the AI screens work.
echo   ------------------------------------------------
goto :end

:cancelled
echo.
echo   Nothing was changed. Run this again when you are ready.

:done
echo.
echo   Left as it was.

:end
echo.
pause