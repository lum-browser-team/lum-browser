@echo off
rem Starts the Lum mini browser (UI preview).
cd /d "%~dp0"
if not exist node_modules\.bin\electron.cmd (
  echo First run: installing Electron...
  call npm install --no-fund --no-audit
)
start "" node_modules\.bin\electron.cmd .
