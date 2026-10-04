@echo off
chcp 65001 > nul
title Push to Eyevengers GitHub (pradeepbhati-1602)
cd /d "%~dp0"
echo =======================================================
echo   PUSHING TO pradeepbhati-1602/eyevengers-app
echo =======================================================
echo.
git -c credential.username=pradeepbhati-1602 push eyevengers main
echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Code push ho gaya hai!
    echo Vercel ab automatically naya version deploy kar raha hai.
) else (
    echo [ERROR] Push nahi ho paya. Upar diya gaya error check karein.
)
echo.
pause
