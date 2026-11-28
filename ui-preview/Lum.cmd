@echo off
rem Starts Lum Preview, the Lum UI mockup (mini browser).
cd /d "%~dp0"
if not exist node_modules\.bin\electron.cmd (
  echo First run: installing Electron...
  call npm install --no-fund --no-audit
)
start "" node_modules\.bin\electron.cmd .
