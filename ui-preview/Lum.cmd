@echo off
rem Uruchamia mini przegladarke Lum (podglad interfejsu).
cd /d "%~dp0"
if not exist node_modules\.bin\electron.cmd (
  echo Pierwsze uruchomienie: instaluje Electrona...
  call npm install --no-fund --no-audit
)
start "" node_modules\.bin\electron.cmd .
