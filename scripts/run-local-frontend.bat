@echo off
chcp 65001 >nul
title Academy Frontend (9999 로컬 개발)
color 0B

echo ========================================
echo   Academy Frontend - 9999 로컬 개발
echo ========================================
echo.

REM 이 배치 파일이 있는 폴더(scripts)의 상위 = 프로젝트 루트 (바탕화면 바로가기에서도 동작)
cd /d "%~dp0.."
if errorlevel 1 (
  echo [오류] 프로젝트 폴더로 이동할 수 없습니다.
  echo 바로가기가 academyfront\scripts\run-local-frontend.bat 을 가리키는지 확인하세요.
  pause
  exit /b 1
)

echo 프로젝트 폴더: %CD%
echo.
echo Vite 개발 서버 시작 중...
echo 9999 테넌트: http://localhost:5174/login/9999
echo 관리자 앱:   http://localhost:5174/admin
echo.

pnpm dev
if errorlevel 1 (
  echo.
  echo pnpm이 PATH에 없거나 실패했습니다. npm으로 시도합니다...
  npm run dev
  if errorlevel 1 (
    echo.
    echo [오류] 실행 실패. 다음을 확인하세요:
    echo   1. Node.js 설치: https://nodejs.org/
    echo   2. 이 폴더에서 "pnpm install" 또는 "npm install" 실행
    echo   3. 포트 5174 사용 중이면 해당 프로세스를 종료하세요.
    echo.
    pause
    exit /b 1
  )
)

pause
