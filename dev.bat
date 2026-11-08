@echo off
title RSS Feed Aggregator - DEV MODE
color 0B
echo.
echo  ============================================
echo   RSS FEED AGGREGATOR - Development Mode
echo  ============================================
echo.
echo  Server: http://localhost:3001 (API)
echo  Client: http://localhost:3000 (React dev server)
echo.

cd /d "%~dp0"

if not exist "server\node_modules" (
    echo Installing server deps...
    cd server && call npm.cmd install && cd ..
)
if not exist "client\node_modules" (
    echo Installing client deps...
    cd client && call npm.cmd install && cd ..
)

echo Starting backend server...
start "RSS-SERVER" cmd /k "cd /d %~dp0server && node index.js"
timeout /t 2 /nobreak >nul

echo Starting React dev server...
start "RSS-CLIENT" cmd /k "cd /d %~dp0client && set PORT=3000 && npm.cmd start"
timeout /t 3 /nobreak >nul

start "" "http://localhost:3000"
echo Done! Both servers are running.
pause

