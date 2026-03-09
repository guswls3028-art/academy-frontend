@echo off
chcp 65001 >nul
title Academy Frontend (9999 로컬 개발)
color 0B

cd /d "%~dp0"
if not exist "package.json" (
  echo [오류] package.json 이 없습니다. 경로를 확인하세요: %CD%
  pause
  exit /b 1
)

if exist "node_modules\.bin" set "PATH=%CD%\node_modules\.bin;%PATH%"

echo ========================================
echo   Academy Frontend - 9999 로컬 개발
echo ========================================
echo   폴더: %CD%
echo   로그인: http://localhost:5174/login/9999
echo   관리자: http://localhost:5174/admin
echo ========================================
echo.

pnpm dev
if errorlevel 1 (
  echo.
  npm run dev
  if errorlevel 1 (
    echo [오류] pnpm/npm 실행 실패. Node 설치 및 "pnpm install" 확인 후 다시 시도하세요.
    pause
    exit /b 1
  )
)

pause
