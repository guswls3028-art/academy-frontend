@echo off
chcp 65001 >nul
title 프론트 Git Push
cd /d C:\academyfront
echo.
echo [academyfront] git add -A
git add -A
echo.
echo [academyfront] git status
git status
echo.
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update"
)
git push origin main
if errorlevel 1 (
  echo.
  echo push 실패. remote/branch 확인 후 다시 시도하세요.
) else (
  echo.
  echo push 완료. Cloudflare에서 자동 배포가 진행됩니다.
)
echo.
pause
