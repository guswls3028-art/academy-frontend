@echo off
chcp 65001 >nul
title Academy Frontend (9999 로컬 개발)
color 0B

REM 배치 파일 위치 기준으로 frontend 폴더로 이동
cd /d "%~dp0.."
if errorlevel 1 (
  echo [오류] 프로젝트 폴더로 이동할 수 없습니다.
  echo 배치 경로: %~dp0
  pause
  exit /b 1
)

REM 잘못된 바로가기(예: academyfront)로 실행된 경우 감지
if not exist "package.json" (
  echo [오류] 이 폴더에 package.json 이 없습니다.
  echo   현재 경로: %CD%
  echo   바탕화면 바로가기가 잘못된 경로를 가리키고 있을 수 있습니다.
  echo.
  echo 해결: 아래를 PowerShell에서 실행한 뒤 바탕화면 "Academy Frontend"를 다시 실행하세요.
  echo   cd C:\academy\frontend
  echo   pwsh -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1
  echo.
  pause
  exit /b 1
)

REM 로컬 node_modules\.bin 을 PATH 앞에 추가 (바로가기에서 실행 시 pnpm 인식)
if exist "node_modules\.bin" set "PATH=%CD%\node_modules\.bin;%PATH%"

echo ========================================
echo   Academy Frontend - 9999 로컬 개발
echo ========================================
echo.
echo 프로젝트 폴더: %CD%
echo.
echo Vite 개발 서버 시작 중...
echo 9999 테넌트: http://localhost:5174/login/9999
echo 관리자 앱:   http://localhost:5174/admin
echo.

pnpm dev
if errorlevel 1 (
  echo.
  echo pnpm이 실패했습니다. npm으로 시도합니다...
  npm run dev
  if errorlevel 1 (
    echo.
    echo [오류] 실행 실패. 확인할 것:
    echo   1. Node.js 설치: https://nodejs.org/
    echo   2. 이 폴더에서 "pnpm install" 또는 "npm install" 실행
    echo   3. 포트 5174 사용 중이면 해당 프로세스를 종료하세요.
    echo.
    pause
    exit /b 1
  )
)

pause
