
@echo off
title RSS Feed Aggregator
color 0A
echo.
echo  ============================================
echo   RSS FEED AGGREGATOR - Starting up...
echo  ============================================
echo.

cd /d "%~dp0"

REM Check if dependencies are installed
if not exist "server\node_modules" (
    echo [1/2] Installing server dependencies...
    cd server
    call npm.cmd install
    cd ..
    echo Done.
)

if not exist "client\build" (
    echo [2/2] Building client...
    cd client
    call npm.cmd install
    call npm.cmd run build
    cd ..
    echo Done.
)

echo.
echo  Starting RSS Aggregator on http://localhost:3001
echo  Press Ctrl+C to stop.
echo.

start "" "http://localhost:3001"
node server\index.js
pause
