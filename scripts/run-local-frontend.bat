@echo off
chcp 65001 >nul
title Academy Frontend (Local)
color 0B

echo ========================================
echo   Academy Frontend - Local Development
echo ========================================
echo.

cd /d C:\academyfront

echo Starting Vite dev server...
echo Frontend URL: http://localhost:5174
echo.

pnpm dev

pause
